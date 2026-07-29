import { startServer } from "./server.mjs";

startServer().catch((error) => {
  console.error(`Codex Meter stopped: ${error?.message ?? error}`);
  process.exitCode = 1;
});
