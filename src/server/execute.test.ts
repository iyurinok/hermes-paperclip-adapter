import * as assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  HERMES_SESSION_ID_PATTERN,
  execute,
  parseHermesOutput,
  resolveBridgeGate,
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

describe("execute bridge gate", () => {
  it("returns before starting Hermes when the bridge is disabled", async () => {
    const logs: string[] = [];
    const result = await execute({
      runId: "run_disabled",
      agent: {
        id: "agent_1",
        companyId: "company_1",
        name: "Hermes",
        adapterType: "hermes_local",
        adapterConfig: { bridgeEnabled: false, hermesCommand: "/missing/hermes" },
      },
      runtime: { sessionId: null, sessionParams: null, sessionDisplayId: null, taskKey: null },
      config: {},
      context: {},
      onLog: async (_stream, chunk) => {
        logs.push(chunk);
      },
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.resultJson?.bridge_enabled, false);
    assert.match(logs.join(""), /bridge disabled/);
    assert.match(logs.join(""), /No Hermes call attempted/);
  });
});

describe("resolveBridgeGate", () => {
  it("keeps the bridge disabled by default", () => {
    assert.deepEqual(resolveBridgeGate({}), { enabled: false, mode: "cli" });
  });

  it("accepts explicit config and environment enable flags", () => {
    assert.equal(resolveBridgeGate({ bridgeEnabled: true }).enabled, true);

    const previous = process.env.PAPERCLIP_HERMES_BRIDGE_ENABLED;
    process.env.PAPERCLIP_HERMES_BRIDGE_ENABLED = "yes";
    try {
      assert.equal(resolveBridgeGate({}).enabled, true);
    } finally {
      if (previous === undefined) {
        delete process.env.PAPERCLIP_HERMES_BRIDGE_ENABLED;
      } else {
        process.env.PAPERCLIP_HERMES_BRIDGE_ENABLED = previous;
      }
    }
  });
});
