import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";
import assert from "node:assert/strict";
import test from "node:test";

import { CodexAppServerSource } from "../src/codex-source.mjs";

function fakeAppServer(result) {
  const process = new EventEmitter();
  process.stdout = new PassThrough();
  process.stderr = new PassThrough();
  process.killed = false;
  process.kill = () => {
    process.killed = true;
    process.emit("exit", 0, null);
  };

  const messages = [];
  let buffered = "";
  process.stdin = new Writable({
    write(chunk, _encoding, done) {
      buffered += chunk.toString();
      while (buffered.includes("\n")) {
        const newline = buffered.indexOf("\n");
        const message = JSON.parse(buffered.slice(0, newline));
        buffered = buffered.slice(newline + 1);
        messages.push(message);
        if (message.method === "initialize") {
          queueMicrotask(() =>
            process.stdout.write(`${JSON.stringify({ id: message.id, result: {} })}\n`),
          );
        }
        if (message.method === "account/rateLimits/read") {
          queueMicrotask(() =>
            process.stdout.write(`${JSON.stringify({ id: message.id, result })}\n`),
          );
        }
      }
      done();
    },
  });

  return { process, messages };
}

test("performs the app-server handshake and reads rate limits", async () => {
  const expected = {
    rateLimits: {
      primary: { usedPercent: 10, windowDurationMins: 10_080, resetsAt: 123 },
    },
  };
  const fake = fakeAppServer(expected);
  const source = new CodexAppServerSource({
    spawnProcess: () => fake.process,
    requestTimeoutMs: 1_000,
  });

  assert.deepEqual(await source.readRateLimits(), expected);
  assert.deepEqual(
    fake.messages.map(({ method }) => method),
    ["initialize", "initialized", "account/rateLimits/read"],
  );
  assert.deepEqual(fake.messages[0].params.clientInfo, {
    name: "codex_meter_bridge",
    title: "Codex Meter Bridge",
    version: "1.1.1",
  });
  assert.deepEqual(fake.messages[2].params, {});

  source.close();
  assert.equal(fake.process.killed, true);
});

test("completes one handshake before concurrent rate-limit requests", async () => {
  const fake = fakeAppServer({ rateLimits: {} });
  const source = new CodexAppServerSource({
    spawnProcess: () => fake.process,
    requestTimeoutMs: 1_000,
  });

  await Promise.all([source.readRateLimits(), source.readRateLimits()]);

  assert.deepEqual(
    fake.messages.map(({ method }) => method),
    [
      "initialize",
      "initialized",
      "account/rateLimits/read",
      "account/rateLimits/read",
    ],
  );
  source.close();
});

test("surfaces typed protocol errors from app-server", async () => {
  const fake = fakeAppServer(null);
  const originalWrite = fake.process.stdin._write.bind(fake.process.stdin);
  fake.process.stdin._write = (chunk, encoding, done) => {
    const message = JSON.parse(chunk.toString());
    if (message.method === "account/rateLimits/read") {
      fake.messages.push(message);
      queueMicrotask(() =>
        fake.process.stdout.write(
          `${JSON.stringify({ id: message.id, error: { code: -32000, message: "unauthorized" } })}\n`,
        ),
      );
      done();
      return;
    }
    originalWrite(chunk, encoding, done);
  };
  const source = new CodexAppServerSource({
    spawnProcess: () => fake.process,
    requestTimeoutMs: 1_000,
  });

  await assert.rejects(() => source.readRateLimits(), /unauthorized/);
  source.close();
});
