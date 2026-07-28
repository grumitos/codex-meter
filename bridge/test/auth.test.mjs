import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { RequestAuthenticator } from "../src/auth.mjs";

const KEY = Buffer.alloc(32, 0x41);
const NOW_SECONDS = 1_800_000_000;
const NONCE = Buffer.alloc(16, 0x42).toString("base64url");

function requestHeaders({
  key = KEY,
  time = NOW_SECONDS,
  nonce = NONCE,
} = {}) {
  const message = `v1\nGET\n/v1/usage\n${time}\n${nonce}`;
  return {
    "x-codex-meter-time": String(time),
    "x-codex-meter-nonce": nonce,
    "x-codex-meter-auth": createHmac("sha256", key)
      .update(message)
      .digest("base64url"),
  };
}

test("accepts a correctly signed usage request", () => {
  const authenticator = new RequestAuthenticator(KEY, {
    clock: () => NOW_SECONDS * 1_000,
  });

  assert.equal(
    authenticator.authenticate({
      method: "GET",
      pathname: "/v1/usage",
      headers: requestHeaders(),
    }),
    true,
  );
});

test("matches the Android request signature vector", () => {
  const key = Buffer.from(Array.from({ length: 32 }, (_, index) => index));
  const headers = requestHeaders({
    key,
    time: 1_700_000_000,
    nonce: "AQIDBAUGBwgJCgsMDQ4PEA",
  });

  assert.equal(
    headers["x-codex-meter-auth"],
    "_BwjULNtqOlbSnY32BrkXIJREF-Ab_XXSr1gft6m8bY",
  );
});

test("rejects expired, malformed, incorrectly signed, and replayed requests identically", () => {
  const authenticator = new RequestAuthenticator(KEY, {
    clock: () => NOW_SECONDS * 1_000,
  });
  const valid = requestHeaders();

  assert.equal(
    authenticator.authenticate({
      method: "GET",
      pathname: "/v1/usage",
      headers: requestHeaders({ time: NOW_SECONDS - 121 }),
    }),
    false,
  );
  assert.equal(
    authenticator.authenticate({
      method: "GET",
      pathname: "/v1/usage",
      headers: { ...valid, "x-codex-meter-nonce": "not+base64" },
    }),
    false,
  );
  assert.equal(
    authenticator.authenticate({
      method: "GET",
      pathname: "/v1/usage",
      headers: requestHeaders({ key: Buffer.alloc(32, 0x43) }),
    }),
    false,
  );
  assert.equal(
    authenticator.authenticate({
      method: "GET",
      pathname: "/v1/usage",
      headers: valid,
    }),
    true,
  );
  assert.equal(
    authenticator.authenticate({
      method: "GET",
      pathname: "/v1/usage",
      headers: valid,
    }),
    false,
  );
});
