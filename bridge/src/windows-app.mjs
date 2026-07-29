import { spawn } from "node:child_process";
import { appendFile, mkdir, rename, writeFile } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import path from "node:path";

import { startServer } from "./server.mjs";

const PAIRING_PAGE = "http://localhost:4318/";
const DATA_DIRECTORY = path.join(
  process.env.LOCALAPPDATA || path.dirname(process.execPath),
  "CodexMeter",
);

function privateAddressScore(address) {
  const [first, second] = address.split(".").map(Number);
  if (first === 192 && second === 168) return 0;
  if (first === 10) return 1;
  if (first === 172 && second >= 16 && second <= 31) return 2;
  return -1;
}

export function choosePrivateIpv4(networks) {
  const candidates = Object.values(networks)
    .flat()
    .filter((address) =>
      address &&
      !address.internal &&
      (address.family === 4 || address.family === "IPv4")
    )
    .map(({ address }) => ({ address, score: privateAddressScore(address) }))
    .filter(({ score }) => score >= 0)
    .sort((left, right) => left.score - right.score);

  if (candidates.length === 0) {
    throw new Error("Connect this PC to a private Wi-Fi or Ethernet network.");
  }
  return candidates[0].address;
}

export function shouldStartWindowsController(environment) {
  return environment.CODEX_METER_RUN === "1";
}

async function writeCurrentEndpoint() {
  await mkdir(DATA_DIRECTORY, { recursive: true, mode: 0o700 });
  const endpoint = path.join(DATA_DIRECTORY, "pairing-endpoint.json");
  const temporary = `${endpoint}.${process.pid}.tmp`;
  const host = choosePrivateIpv4(networkInterfaces());
  await writeFile(temporary, `${JSON.stringify({ host, port: 4317 })}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporary, endpoint);
  process.env.CODEX_METER_HOST = host;
}

async function pageIsReady() {
  try {
    return (await fetch(PAIRING_PAGE, { cache: "no-store" })).ok;
  } catch {
    return false;
  }
}

function openPairingPage() {
  spawn("rundll32.exe", ["url.dll,FileProtocolHandler", PAIRING_PAGE], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  }).unref();
}

function watchParent(shutdown) {
  const parentPid = Number(process.env.CODEX_METER_PARENT_PID);
  if (!Number.isSafeInteger(parentPid) || parentPid <= 0) return;
  const monitor = setInterval(() => {
    try {
      process.kill(parentPid, 0);
    } catch {
      clearInterval(monitor);
      shutdown();
    }
  }, 500);
  monitor.unref();
}

async function waitForPairingPage() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await pageIsReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("The Codex Meter controller could not start.");
}

async function main() {
  const selfTestOutput = process.argv[process.argv.indexOf("--self-test") + 1];
  if (process.argv.includes("--self-test")) {
    if (!selfTestOutput || selfTestOutput === process.execPath) {
      throw new Error("Missing self-test output path.");
    }
    await writeFile(selfTestOutput, JSON.stringify({
      host: choosePrivateIpv4(networkInterfaces()),
      runtime: process.version,
    }));
    return;
  }

  await writeCurrentEndpoint();
  if (await pageIsReady()) {
    openPairingPage();
    return;
  }

  const controller = await startServer({ host: process.env.CODEX_METER_HOST });
  watchParent(controller.shutdown);
  await waitForPairingPage();
  openPairingPage();
}

if (shouldStartWindowsController(process.env)) {
  main().catch(async (error) => {
    await mkdir(DATA_DIRECTORY, { recursive: true }).catch(() => {});
    await appendFile(
      path.join(DATA_DIRECTORY, "controller.log"),
      `${new Date().toISOString()} ${error?.stack || error}\n`,
    ).catch(() => {});
    process.exitCode = 1;
  });
}
