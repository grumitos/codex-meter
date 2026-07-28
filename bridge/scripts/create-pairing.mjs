import { homedir } from "node:os";
import { chmod, mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { createPairingUri } from "../src/pairing-page.mjs";
import { loadOrCreatePairingMaterial } from "../src/pairing-store.mjs";

function readArguments(values) {
  const result = { rotate: false };
  for (let index = 0; index < values.length; index += 1) {
    const name = values[index];
    if (name === "--rotate") {
      result.rotate = true;
      continue;
    }
    const value = values[index + 1];
    if (!value || !["--host", "--port", "--output", "--data-dir"].includes(name)) {
      throw new Error("Invalid pairing arguments");
    }
    result[name.slice(2).replace("-", "_")] = value;
    index += 1;
  }
  if (!result.host || !result.port || !result.output) {
    throw new Error("Missing pairing arguments");
  }
  return result;
}

try {
  const options = readArguments(process.argv.slice(2));
  const dataDirectory =
    options.data_dir ||
    path.join(
      process.env.LOCALAPPDATA || path.join(homedir(), ".local", "share"),
      "CodexMeter",
    );
  const material = await loadOrCreatePairingMaterial(dataDirectory, {
    rotate: options.rotate,
  });
  const endpoint = {
    host: options.host,
    port: Number(options.port),
  };
  createPairingUri({ ...endpoint, key: material.key, pin: material.pin });

  await mkdir(path.dirname(options.output), { recursive: true, mode: 0o700 });
  const temporaryPath = `${options.output}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(endpoint)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporaryPath, options.output);
  await chmod(options.output, 0o600);
} catch {
  console.error("No se pudo generar el emparejamiento local.");
  process.exitCode = 1;
}
