import assert from "node:assert/strict";
import test from "node:test";

import { normalizeRateLimits } from "../src/normalize.mjs";

test("returns only the exact weekly Codex window", () => {
  const actual = normalizeRateLimits({
    rateLimits: {
      primary: {
        usedPercent: 35,
        windowDurationMins: 10_080,
        resetsAt: 1_785_733_200,
      },
      secondary: { usedPercent: 80.5, windowDurationMins: 60 },
    },
  });

  assert.deepEqual(actual, {
    remainingPercent: 65,
    resetsAt: "2026-08-03T05:00:00.000Z",
    stale: false,
  });
});

test("omits a missing secondary window", () => {
  const actual = normalizeRateLimits({
    rateLimits: {
      primary: {
        usedPercent: 0,
        windowDurationMins: 10_080,
        resetsAt: 1_785_733_200,
      },
      secondary: null,
    },
  });

  assert.equal(actual.remainingPercent, 100);
});

test("does not substitute a short window for the weekly limit", () => {
  assert.throws(
    () =>
      normalizeRateLimits({
        rateLimits: {
          primary: {
            usedPercent: 35,
            windowDurationMins: 60,
            resetsAt: 1_785_733_200,
          },
        },
      }),
    /weekly window/i,
  );
});

test("rejects malformed or empty source responses", () => {
  assert.throws(() => normalizeRateLimits({ rateLimits: {} }), /weekly window/i);
  assert.throws(
    () =>
      normalizeRateLimits({
        rateLimits: {
          primary: {
            usedPercent: 101,
            windowDurationMins: 10_080,
            resetsAt: 1_785_733_200,
          },
        },
      }),
    /usedPercent/i,
  );
  assert.throws(
    () =>
      normalizeRateLimits({
        rateLimits: {
          primary: {
            usedPercent: 35,
            windowDurationMins: 10_080,
          },
        },
      }),
    /resetsAt/i,
  );
});
