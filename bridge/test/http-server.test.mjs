import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import https from "node:https";
import test from "node:test";

import { generate } from "selfsigned";

import { createUsageServer } from "../src/http-server.mjs";
import { UsageUnavailableError } from "../src/usage-service.mjs";

const KEY = Buffer.alloc(32, 0x41);
const NOW_SECONDS = 1_800_000_000;
const TLS = await generate(
  [{ name: "commonName", value: "Codex Meter test" }],
  { days: 1, keyType: "ec", curve: "P-256", algorithm: "sha256" },
);
let nonceCounter = 0;

function signedHeaders({ key = KEY } = {}) {
  nonceCounter += 1;
  const time = String(NOW_SECONDS);
  const nonce = Buffer.alloc(16, nonceCounter).toString("base64url");
  return {
    "X-Codex-Meter-Time": time,
    "X-Codex-Meter-Nonce": nonce,
    "X-Codex-Meter-Auth": createHmac("sha256", key)
      .update(`v1\nGET\n/v1/usage\n${time}\n${nonce}`)
      .digest("base64url"),
  };
}

function httpsRequest(url, { method = "GET", headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      { method, headers, rejectUnauthorized: false },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body: Buffer.concat(chunks),
          }),
        );
      },
    );
    request.on("error", reject);
    request.end();
  });
}

async function withServer(service, callback) {
  const server = createUsageServer(service, {
    authenticationKey: KEY,
    clock: () => NOW_SECONDS * 1_000,
    tls: { key: TLS.private, cert: TLS.cert },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    await callback(`https://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("serves the authenticated usage contract over TLS without HTTP caching", async () => {
  const usage = {
    remainingPercent: 65,
    resetsAt: "2026-08-03T05:00:00.000Z",
    stale: false,
  };
  await withServer({ readUsage: async () => usage }, async (baseUrl) => {
    const headers = signedHeaders();
    const response = await httpsRequest(`${baseUrl}/v1/usage`, { headers });
    assert.equal(response.status, 200);
    assert.equal(response.headers["cache-control"], "no-store");
    assert.equal(response.headers["x-content-type-options"], "nosniff");
    assert.deepEqual(JSON.parse(response.body), usage);

    assert.equal((await httpsRequest(`${baseUrl}/healthz`)).status, 404);
    assert.equal(
      (
        await httpsRequest(`${baseUrl}/v1/usage`, {
          method: "POST",
        })
      ).status,
      405,
    );
  });
});

test("rejects missing and invalid authentication without revealing why", async () => {
  await withServer({ readUsage: async () => ({}) }, async (baseUrl) => {
    const missing = await httpsRequest(`${baseUrl}/v1/usage`);
    const invalid = await httpsRequest(`${baseUrl}/v1/usage`, {
      headers: signedHeaders({ key: Buffer.alloc(32, 0x43) }),
    });

    assert.equal(missing.status, 401);
    assert.equal(invalid.status, 401);
    assert.deepEqual(missing.body, invalid.body);
    assert.deepEqual(JSON.parse(missing.body), { error: "unauthorized" });
  });
});

test("maps missing source and cache to 503 without leaking the cause", async () => {
  await withServer(
    {
      readUsage: async () => {
        throw new UsageUnavailableError({ cause: new Error("private path") });
      },
    },
    async (baseUrl) => {
      const headers = signedHeaders();
      const response = await httpsRequest(`${baseUrl}/v1/usage`, { headers });
      const body = JSON.parse(response.body);
      assert.equal(response.status, 503);
      assert.deepEqual(body, { error: "usage_unavailable" });
      assert.doesNotMatch(JSON.stringify(body), /private path/);
    },
  );
});
