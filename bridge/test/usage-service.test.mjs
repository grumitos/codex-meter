import assert from "node:assert/strict";
import test from "node:test";

import { UsageService, UsageUnavailableError } from "../src/usage-service.mjs";

const SOURCE_RESULT = {
  rateLimits: {
    primary: {
      usedPercent: 35,
      windowDurationMins: 10_080,
      resetsAt: 1_785_733_200,
    },
  },
};

function memoryCache(initialValue = null) {
  let value = initialValue;
  return {
    async load() {
      return value;
    },
    async save(nextValue) {
      value = structuredClone(nextValue);
    },
  };
}

test("returns current data and saves only its normalized form", async () => {
  const cache = memoryCache();
  const service = new UsageService({
    source: { readRateLimits: async () => SOURCE_RESULT },
    cache,
  });

  const result = await service.readUsage();

  assert.equal(result.stale, false);
  assert.equal(result.remainingPercent, 65);
  assert.equal(result.resetsAt, "2026-08-03T05:00:00.000Z");
  assert.deepEqual(await cache.load(), result);
});

test("returns cached data marked stale when Codex is unavailable", async () => {
  const cached = {
    remainingPercent: 65,
    resetsAt: "2026-08-03T05:00:00.000Z",
    stale: false,
  };
  const service = new UsageService({
    source: { readRateLimits: async () => Promise.reject(new Error("offline")) },
    cache: memoryCache(cached),
  });

  const result = await service.readUsage();

  assert.deepEqual(result, { ...cached, stale: true });
});

test("returns fresh data even when updating the cache fails", async () => {
  const service = new UsageService({
    source: { readRateLimits: async () => SOURCE_RESULT },
    cache: {
      async load() {
        return null;
      },
      async save() {
        throw new Error("disk unavailable");
      },
    },
  });

  assert.deepEqual(
    await service.readUsage(),
    {
      remainingPercent: 65,
      resetsAt: "2026-08-03T05:00:00.000Z",
      stale: false,
    },
  );
});

test("throws a typed error when Codex and the cache are unavailable", async () => {
  const service = new UsageService({
    source: { readRateLimits: async () => Promise.reject(new Error("offline")) },
    cache: memoryCache(),
  });

  await assert.rejects(() => service.readUsage(), UsageUnavailableError);
});
