import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { JsonFileCache } from "../src/file-cache.mjs";

const USAGE = {
  remainingPercent: 65,
  resetsAt: "2026-08-03T05:00:00.000Z",
  stale: false,
};

test("persists only the sanitized usage document", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "codex-meter-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, "usage.json");
  const cache = new JsonFileCache(filePath);

  await cache.save(USAGE);

  assert.deepEqual(await cache.load(), USAGE);
  assert.deepEqual(JSON.parse(await readFile(filePath, "utf8")), USAGE);
});

test("treats a missing or corrupt cache as unavailable", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "codex-meter-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, "usage.json");
  const cache = new JsonFileCache(filePath);

  assert.equal(await cache.load(), null);
  await writeFile(filePath, "not json", "utf8");
  assert.equal(await cache.load(), null);
});
