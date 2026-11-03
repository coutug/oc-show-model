import { Rpc } from "@opencode/plugin/rpc"

/**
 * Shared RPC contract between the server part (source of truth) and the TUI part (display).
 *
 * - Event `model.selected`: emitted every time a primary OpenRouter response reveals the
 *   model that actually served the request.
 * - Method `getLatest`: lets the TUI fetch the last known model for a session, e.g. when a
 *   session is reopened before any new response arrives.
 *
 * Plain JSON Schema keeps the contract dependency-free; the portable definition is what
 * server (`ctx.rpc.register`) and TUI (`context.client.rpc`) both accept.
 */
export const ActualModelRpc = Rpc.define({
  id: "oc-show-model",
  methods: {
    getLatest: {
      input: {
        type: "object",
        properties: { sessionID: { type: "string" } },
        required: ["sessionID"],
      },
      output: {
        type: "object",
        properties: { model: { type: ["string", "null"] } },
        required: ["model"],
      },
    },
  },
  events: {
    "model.selected": {
      schema: {
        type: "object",
        properties: {
          sessionID: { type: "string" },
          model: { type: "string" },
        },
        required: ["sessionID", "model"],
      },
    },
  },
} satisfies Rpc.PortableDefinition)
