import { createHmac, timingSafeEqual } from "node:crypto";

const REQUEST_VERSION = "v1";
const REQUEST_METHOD = "GET";
const REQUEST_PATH = "/v1/usage";
const DEFAULT_TOLERANCE_SECONDS = 120;

function decodeBase64Url(value, minimumBytes, maximumBytes = minimumBytes) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) {
    return null;
  }
  const decoded = Buffer.from(value, "base64url");
  if (
    decoded.byteLength < minimumBytes ||
    decoded.byteLength > maximumBytes ||
    decoded.toString("base64url") !== value
  ) {
    return null;
  }
  return decoded;
}

function requireKey(key) {
  if (!Buffer.isBuffer(key) || key.byteLength !== 32) {
    throw new TypeError("The pairing key must contain exactly 32 bytes");
  }
}

export class RequestAuthenticator {
  constructor(
    key,
    {
      clock = Date.now,
      toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
    } = {},
  ) {
    requireKey(key);
    this.key = Buffer.from(key);
    this.clock = clock;
    this.toleranceSeconds = toleranceSeconds;
    this.seenNonces = new Map();
  }

  authenticate({ method, pathname, headers }) {
    const time = headers["x-codex-meter-time"];
    const nonce = headers["x-codex-meter-nonce"];
    const suppliedAuth = decodeBase64Url(
      headers["x-codex-meter-auth"],
      32,
    );
    const nonceBytes = decodeBase64Url(nonce, 16, 32);
    if (
      method !== REQUEST_METHOD ||
      pathname !== REQUEST_PATH ||
      typeof time !== "string" ||
      !/^\d{1,12}$/.test(time) ||
      nonceBytes === null ||
      suppliedAuth === null
    ) {
      return false;
    }

    const requestSeconds = Number(time);
    const nowSeconds = Math.floor(this.clock() / 1_000);
    if (
      !Number.isSafeInteger(requestSeconds) ||
      Math.abs(nowSeconds - requestSeconds) > this.toleranceSeconds
    ) {
      return false;
    }

    const expectedAuth = createHmac("sha256", this.key)
      .update(`${REQUEST_VERSION}\n${method}\n${pathname}\n${time}\n${nonce}`)
      .digest();
    if (!timingSafeEqual(expectedAuth, suppliedAuth)) {
      return false;
    }

    for (const [seenNonce, expiresAt] of this.seenNonces) {
      if (expiresAt < nowSeconds) {
        this.seenNonces.delete(seenNonce);
      }
    }
    if (this.seenNonces.has(nonce)) {
      return false;
    }
    this.seenNonces.set(nonce, requestSeconds + this.toleranceSeconds);

    return true;
  }
}
