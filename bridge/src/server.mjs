import path from "node:path";
import { homedir } from "node:os";
import { readFile } from "node:fs/promises";

import { CodexAppServerSource } from "./codex-source.mjs";
import { JsonFileCache } from "./file-cache.mjs";
import { createPairingServer, createUsageServer } from "./http-server.mjs";
import { renderPairingHtml } from "./pairing-page.mjs";
import { loadOrCreatePairingMaterial } from "./pairing-store.mjs";
import { UsageService } from "./usage-service.mjs";

export async function startServer({
  host = process.env.CODEX_METER_HOST || "0.0.0.0",
  port = 4317,
  pairingPort = 4318,
} = {}) {
  const dataDirectory =
    process.env.CODEX_METER_DATA_DIR ||
    path.join(
      process.env.LOCALAPPDATA || path.join(homedir(), ".local", "share"),
      "CodexMeter",
    );
  const pairing = await loadOrCreatePairingMaterial(dataDirectory);
  const source = new CodexAppServerSource();
  const cache = new JsonFileCache(path.join(dataDirectory, "usage-cache.json"));
  const service = new UsageService({ source, cache });
  let connected = false;
  const pairingEndpoint = path.join(dataDirectory, "pairing-endpoint.json");
  const pairingServer = createPairingServer(async () => {
    const endpoint = JSON.parse(await readFile(pairingEndpoint, "utf8"));
    return renderPairingHtml({ ...endpoint, key: pairing.key, pin: pairing.pin });
  }, () => connected);
  const server = createUsageServer(service, {
    authenticationKey: pairing.key,
    onConnected: () => { connected = true; },
    tls: {
      key: pairing.privateKeyPem,
      cert: pairing.certificatePem,
    },
  });

  server.listen(port, host, () => {
    void service.readUsage().catch(() => {});
  });
  pairingServer.listen(pairingPort, "127.0.0.1");

  let shuttingDown = false;

  function shutdown(exitCode = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    source.close();
    const listeningServers = [server, pairingServer].filter(
      (candidate) => candidate.listening,
    );
    if (listeningServers.length === 0) {
      process.exit(exitCode);
    }
    const forceExit = setTimeout(() => process.exit(exitCode), 1_000);
    forceExit.unref();
    let openServers = listeningServers.length;
    const closed = () => {
      openServers -= 1;
      if (openServers === 0) {
        clearTimeout(forceExit);
        process.exit(exitCode);
      }
    };
    for (const listeningServer of listeningServers) listeningServer.close(closed);
  }

  function fail(error) {
    console.error(`Codex Meter stopped: ${error?.message ?? error}`);
    shutdown(1);
  }

  server.once("error", fail);
  pairingServer.once("error", fail);
  process.once("uncaughtException", fail);
  process.once("unhandledRejection", fail);
  process.once("exit", () => source.close());
  process.once("SIGINT", () => shutdown());
  process.once("SIGTERM", () => shutdown());

  return { server, pairingServer, shutdown };
}
