import { normalizeRateLimits } from "./normalize.mjs";

export class UsageUnavailableError extends Error {
  constructor(options) {
    super("Codex usage is unavailable and no cached value exists", options);
    this.name = "UsageUnavailableError";
  }
}

export class UsageService {
  constructor({ source, cache }) {
    this.source = source;
    this.cache = cache;
  }

  async readUsage() {
    let usage;
    try {
      const sourceResult = await this.source.readRateLimits();
      usage = normalizeRateLimits(sourceResult);
    } catch (cause) {
      const cached = await this.cache.load();
      if (cached != null) {
        return { ...cached, stale: true };
      }
      throw new UsageUnavailableError({ cause });
    }

    try {
      await this.cache.save(usage);
    } catch {
      // Fresh data is still useful when the best-effort cache is unavailable.
    }
    return usage;
  }
}
