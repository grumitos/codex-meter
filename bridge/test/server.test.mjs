import assert from "node:assert/strict";
import test from "node:test";

import { startServer } from "../src/server.mjs";

test("exports server startup without listening during import", () => {
  assert.equal(typeof startServer, "function");
});
