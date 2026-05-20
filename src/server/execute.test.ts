import * as assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  HERMES_SESSION_ID_PATTERN,
  parseHermesOutput,
} from "./execute.js";
import { sessionCodec } from "./index.js";

describe("parseHermesOutput", () => {
  it("extracts the full quiet-mode Hermes session id", () => {
    const parsed = parseHermesOutput("Done\n\nsession_id: 20260513_144718_6b34d7\n", "");

    assert.equal(parsed.sessionId, "20260513_144718_6b34d7");
    assert.equal(parsed.response, "Done");
  });

  it("does not parse a session id from Hermes session-not-found prose", () => {
    const parsed = parseHermesOutput(
      "Session not found: 20260513_144718_\r\nUse a session ID from a previous CLI run (hermes sessions list).\r\n",
      "",
    );

    assert.equal(parsed.sessionId, undefined);
    assert.match(parsed.response ?? "", /Session not found/);
  });

  it("ignores invalid quiet-mode session ids", () => {
    const parsed = parseHermesOutput("Done\n\nsession_id: from\n", "");

    assert.equal(parsed.sessionId, undefined);
  });

  it("accepts only anchored legacy Hermes session lines", () => {
    const parsed = parseHermesOutput("Session saved: 20260513_144718_6b34d7\n", "");

    assert.equal(parsed.sessionId, "20260513_144718_6b34d7");
  });
});

describe("sessionCodec", () => {
  it("rejects invalid persisted resume ids", () => {
    assert.equal(sessionCodec.serialize({ sessionId: "from" }), null);
    assert.equal(sessionCodec.serialize({ sessionId: "20260513_144718_" }), null);
    assert.equal(sessionCodec.deserialize({ sessionId: "from" }), null);
    assert.equal(sessionCodec.deserialize({ session_id: "20260513_144718_" }), null);
  });

  it("keeps full Hermes session ids", () => {
    const valid = "20260513_144718_6b34d7";

    assert.match(valid, HERMES_SESSION_ID_PATTERN);
    assert.deepEqual(sessionCodec.serialize({ sessionId: valid }), { sessionId: valid });
    assert.deepEqual(sessionCodec.deserialize({ session_id: valid }), { sessionId: valid });
    assert.equal(sessionCodec.getDisplayId?.({ sessionId: valid }), valid);
  });
});
