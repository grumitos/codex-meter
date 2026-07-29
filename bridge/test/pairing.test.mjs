import assert from "node:assert/strict";
import { createHash, X509Certificate } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  loadOrCreatePairingMaterial,
} from "../src/pairing-store.mjs";
import {
  createPairingUri,
  renderPairingHtml,
} from "../src/pairing-page.mjs";
import { createPairingServer } from "../src/http-server.mjs";

test("creates persistent pairing material and rotates it only when requested", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "codex-meter-pairing-"));
  try {
    const first = await loadOrCreatePairingMaterial(directory);
    const unchanged = await loadOrCreatePairingMaterial(directory);
    const rotated = await loadOrCreatePairingMaterial(directory, {
      rotate: true,
    });

    assert.equal(first.key.byteLength, 32);
    assert.deepEqual(unchanged, first);
    assert.notDeepEqual(rotated.key, first.key);
    assert.notEqual(rotated.pin, first.pin);
    assert.equal(
      first.pin,
      createHash("sha256")
        .update(new X509Certificate(first.certificatePem).raw)
        .digest("base64url"),
    );
    assert.equal(
      (await readFile(path.join(directory, "pairing-key"), "utf8")).trim(),
      rotated.key.toString("base64url"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("creates the exact private-LAN pairing URI", () => {
  const key = Buffer.alloc(32, 0x41);
  const pin = Buffer.alloc(32, 0x42).toString("base64url");

  assert.equal(
    createPairingUri({ host: "192.168.1.23", port: 4317, key, pin }),
    `codexmeter://pair?v=1&host=192.168.1.23&port=4317&pin=${pin}&key=${key.toString("base64url")}`,
  );
  assert.throws(() =>
    createPairingUri({ host: "100.64.0.1", port: 4317, key, pin }),
  );
  assert.throws(() =>
    createPairingUri({ host: "8.8.8.8", port: 4317, key, pin }),
  );
});

test("renders a local QR page without exposing secrets as text", async () => {
  const key = Buffer.alloc(32, 0x41);
  const pin = Buffer.alloc(32, 0x42).toString("base64url");
  const html = await renderPairingHtml({
    host: "10.0.0.12",
    port: 4317,
    key,
    pin,
  });

  assert.match(html, /<svg/);
  assert.match(html, /10\.0\.0\.12:4317/);
  assert.doesNotMatch(html, new RegExp(key.toString("base64url")));
  assert.doesNotMatch(html, new RegExp(pin));
});

test("renders the product favicon and main browser languages", async () => {
  const html = await renderPairingHtml({
    host: "10.0.0.12",
    port: 4317,
    key: Buffer.alloc(32, 0x41),
    pin: Buffer.alloc(32, 0x42).toString("base64url"),
  });

  assert.match(html, /<link rel="icon" href="data:image\/svg\+xml,/);
  assert.match(html, /class="product-mark"/);
  assert.match(html, /M12 31V12/);
  assert.match(html, /navigator\.language/);
  for (const language of ["en", "es", "pt", "fr", "de", "ja", "ko", "zh"]) {
    assert.match(html, new RegExp(`\\b${language}:`));
  }
});

test("renders the current pairing page on every local request", async () => {
  let endpoint = "192.168.1.2:4317";
  const server = createPairingServer(async () =>
    `<!doctype html><title>Codex Meter</title><code>${endpoint}</code>`,
  );
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();
    const first = await fetch(`http://127.0.0.1:${port}/`);

    assert.equal(first.status, 200);
    assert.match(first.headers.get("content-type"), /^text\/html/);
    assert.equal(first.headers.get("cache-control"), "no-store");
    assert.match(first.headers.get("content-security-policy"), /script-src 'unsafe-inline'/);
    assert.match(await first.text(), /192\.168\.1\.2:4317/);

    endpoint = "192.168.1.24:5317";
    assert.match(
      await (await fetch(`http://127.0.0.1:${port}/`)).text(),
      /192\.168\.1\.24:5317/,
    );
    assert.equal(
      (await fetch(`http://127.0.0.1:${port}/v1/usage`)).status,
      404,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
