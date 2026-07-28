import path from "node:path";
import { homedir } from "node:os";
import { readFile } from "node:fs/promises";

import { CodexAppServerSource } from "./codex-source.mjs";
import { JsonFileCache } from "./file-cache.mjs";
import { createPairingServer, createUsageServer } from "./http-server.mjs";
import { renderPairingHtml } from "./pairing-page.mjs";
import { loadOrCreatePairingMaterial } from "./pairing-store.mjs";
import { UsageService } from "./usage-service.mjs";

const host = "0.0.0.0";
const port = 4317;
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
const pairingEndpoint = path.join(dataDirectory, "pairing-endpoint.json");
const pairingServer = createPairingServer(async () => {
  const endpoint = JSON.parse(await readFile(pairingEndpoint, "utf8"));
  return renderPairingHtml({ ...endpoint, key: pairing.key, pin: pairing.pin });
});
const server = createUsageServer(service, {
  authenticationKey: pairing.key,
  tls: {
    key: pairing.privateKeyPem,
    cert: pairing.certificatePem,
  },
});

server.listen(port, host, () => {
  void service.readUsage().catch(() => {});
});
pairingServer.listen(4318, "127.0.0.1");

server.on("error", (error) => {
  console.error(`Codex Meter bridge could not start: ${error.message}`);
  process.exitCode = 1;
});
pairingServer.on("error", (error) => {
  console.error(`Codex Meter pairing page could not start: ${error.message}`);
});

function shutdown() {
  source.close();
  let openServers = 2;
  const closed = () => {
    openServers -= 1;
    if (openServers === 0) process.exit(0);
  };
  server.close(closed);
  pairingServer.close(closed);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
