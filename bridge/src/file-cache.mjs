import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

function isUsageDocument(value) {
  return (
    value != null &&
    typeof value === "object" &&
    Number.isInteger(value.remainingPercent) &&
    value.remainingPercent >= 0 &&
    value.remainingPercent <= 100 &&
    typeof value.resetsAt === "string" &&
    Number.isFinite(Date.parse(value.resetsAt)) &&
    typeof value.stale === "boolean"
  );
}

export class JsonFileCache {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async load() {
    try {
      const value = JSON.parse(await readFile(this.filePath, "utf8"));
      return isUsageDocument(value) ? value : null;
    } catch {
      return null;
    }
  }

  async save(usage) {
    const directory = path.dirname(this.filePath);
    await mkdir(directory, { recursive: true });
    const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(usage)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporaryPath, this.filePath);
  }
}
