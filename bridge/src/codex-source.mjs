import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";

function defaultCodexCommand() {
  if (process.platform !== "win32") return "codex";

  const architecture = process.arch === "arm64"
    ? ["codex-win32-arm64", "aarch64-pc-windows-msvc"]
    : ["codex-win32-x64", "x86_64-pc-windows-msvc"];
  const npmPrefix = process.env.npm_config_prefix || path.join(process.env.APPDATA ?? "", "npm");
  const executable = path.join(
    npmPrefix,
    "node_modules",
    "@openai",
    "codex",
    "node_modules",
    "@openai",
    architecture[0],
    "vendor",
    architecture[1],
    "bin",
    "codex.exe",
  );
  return existsSync(executable) ? executable : "codex.exe";
}

class CodexProtocolError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "CodexProtocolError";
  }
}

export class CodexAppServerSource {
  constructor({
    command = process.env.CODEX_METER_CODEX_COMMAND || defaultCodexCommand(),
    spawnProcess = (executable, args, options) => spawn(executable, args, options),
    requestTimeoutMs = 20_000,
  } = {}) {
    this.command = command;
    this.spawnProcess = spawnProcess;
    this.requestTimeoutMs = requestTimeoutMs;
    this.nextId = 1;
    this.pending = new Map();
    this.process = null;
    this.startPromise = null;
  }

  async readRateLimits() {
    await this.#ensureStarted();
    return this.#request("account/rateLimits/read", {});
  }

  close() {
    const processToStop = this.process;
    this.process = null;
    this.startPromise = null;
    this.#rejectPending(new CodexProtocolError("Codex app-server was stopped"));
    if (processToStop != null && !processToStop.killed) {
      processToStop.kill();
    }
  }

  async #ensureStarted() {
    if (this.startPromise != null) return this.startPromise;
    if (this.process != null) return;

    this.startPromise = this.#start();
    try {
      await this.startPromise;
    } catch (error) {
      this.close();
      throw error;
    } finally {
      this.startPromise = null;
    }
  }

  async #start() {
    const child = this.spawnProcess(
      this.command,
      ["app-server", "--listen", "stdio://"],
      {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    this.process = child;
    child.stderr.resume();

    const lines = readline.createInterface({ input: child.stdout });
    lines.on("line", (line) => this.#handleLine(line));
    child.once("error", (cause) => {
      this.#handleTermination(new CodexProtocolError("Could not start Codex app-server", { cause }));
    });
    child.once("exit", (code, signal) => {
      this.#handleTermination(
        new CodexProtocolError(
          `Codex app-server exited (${signal ?? code ?? "unknown"})`,
        ),
      );
    });

    await this.#request("initialize", {
      clientInfo: {
        name: "codex_meter_bridge",
        title: "Codex Meter Bridge",
        version: "1.0.0",
      },
    });
    this.#send({ method: "initialized", params: {} });
  }

  #handleLine(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (message?.id == null) return;

    const pending = this.pending.get(message.id);
    if (pending == null) return;
    this.pending.delete(message.id);
    clearTimeout(pending.timer);

    if (message.error != null) {
      pending.reject(
        new CodexProtocolError(
          typeof message.error.message === "string"
            ? message.error.message
            : "Codex app-server request failed",
        ),
      );
      return;
    }
    pending.resolve(message.result);
  }

  #handleTermination(error) {
    this.process = null;
    this.startPromise = null;
    this.#rejectPending(error);
  }

  #rejectPending(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  #send(message) {
    if (this.process == null || this.process.stdin.destroyed) {
      throw new CodexProtocolError("Codex app-server is not running");
    }
    this.process.stdin.write(`${JSON.stringify(message)}\n`);
  }

  #request(method, params) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new CodexProtocolError(`Codex app-server timed out during ${method}`));
      }, this.requestTimeoutMs);
      timer.unref?.();
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.#send({ method, id, params });
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }
}
