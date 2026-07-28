import http from "node:http";
import https from "node:https";

import { RequestAuthenticator } from "./auth.mjs";
import { UsageUnavailableError } from "./usage-service.mjs";

function sendJson(
  response,
  statusCode,
  body,
  { extraHeaders = {} } = {},
) {
  const encoded = Buffer.from(JSON.stringify(body));
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": encoded.byteLength,
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders,
  });
  response.end(encoded);
}

function sendText(response, statusCode, body, headers = {}) {
  const encoded = Buffer.from(body);
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": encoded.byteLength,
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  response.end(encoded);
}

export function createPairingServer(renderPairingPage) {
  return http.createServer(async (request, response) => {
    let pathname;
    try {
      pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    } catch {
      sendText(response, 404, "No encontrado");
      return;
    }
    if (pathname !== "/") {
      sendText(response, 404, "No encontrado");
      return;
    }
    if (request.method !== "GET") {
      sendText(response, 405, "Método no permitido", { Allow: "GET" });
      return;
    }
    try {
      sendText(response, 200, await renderPairingPage(), {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:",
        "X-Frame-Options": "DENY",
      });
    } catch {
      sendText(response, 503, "Codex Meter todavía no está configurado.");
    }
  });
}

export function createUsageServer(
  service,
  { authenticationKey, tls, clock = Date.now } = {},
) {
  const authenticator = new RequestAuthenticator(authenticationKey, { clock });

  return https.createServer({ minVersion: "TLSv1.2", ...tls }, async (request, response) => {
    let pathname;
    try {
      pathname = new URL(request.url ?? "/", "https://localhost").pathname;
    } catch {
      sendJson(response, 404, { error: "not_found" });
      return;
    }

    if (pathname !== "/v1/usage") {
      sendJson(response, 404, { error: "not_found" });
      return;
    }
    if (request.method !== "GET") {
      sendJson(response, 405, { error: "method_not_allowed" }, {
        extraHeaders: { Allow: "GET" },
      });
      return;
    }

    if (!authenticator.authenticate({
      method: request.method,
      pathname,
      headers: request.headers,
    })) {
      sendJson(response, 401, { error: "unauthorized" });
      return;
    }
    try {
      sendJson(response, 200, await service.readUsage());
    } catch (error) {
      if (error instanceof UsageUnavailableError) {
        sendJson(response, 503, { error: "usage_unavailable" });
        return;
      }
      sendJson(response, 500, { error: "internal_error" });
    }
  });
}
