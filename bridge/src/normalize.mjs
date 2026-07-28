function requireFiniteNumber(value, fieldName) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${fieldName} must be a finite number`);
  }
  return value;
}

function readWeeklyWindow(window) {
  const usedPercent = requireFiniteNumber(window.usedPercent, "usedPercent");
  if (usedPercent < 0 || usedPercent > 100) {
    throw new RangeError("usedPercent must be between 0 and 100");
  }

  const resetsAt = requireFiniteNumber(window.resetsAt, "resetsAt");
  if (!Number.isInteger(resetsAt) || resetsAt <= 0) {
    throw new RangeError("resetsAt must be a positive Unix timestamp");
  }
  const resetDate = new Date(resetsAt * 1_000);
  if (!Number.isFinite(resetDate.getTime())) {
    throw new RangeError("resetsAt must be a valid Unix timestamp");
  }

  return {
    usedPercent,
    resetsAt: resetDate.toISOString(),
  };
}

export function normalizeRateLimits(sourceResult) {
  const rateLimits = sourceResult?.rateLimits;
  const weekly = [rateLimits?.primary, rateLimits?.secondary]
    .find((window) => window?.windowDurationMins === 10_080);

  if (weekly == null) {
    throw new TypeError("Codex returned no weekly window");
  }
  const { usedPercent, resetsAt } = readWeeklyWindow(weekly);

  return {
    remainingPercent: Math.round(100 - usedPercent),
    resetsAt,
    stale: false,
  };
}
