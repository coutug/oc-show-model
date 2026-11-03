import { Plugin } from "@opencode/plugin"
import { ActualModelRpc } from "./rpc.ts"
import { extractModelFromJson, scanSseBuffer } from "./parser.ts"

/**
 * Server part: watches primary OpenRouter HTTP responses, extracts the model
 * that actually served the request, and publishes it over RPC.
 *
 * Observer only: never mutates the request, the response, or the body consumed
 * by OpenCode. The response is cloned; the clone is read in the background and
 * cancelled as soon as a model is found.
 */
export default Plugin.define({
  id: "oc-show-model",
  async setup(ctx) {
    // Last model observed per session, in memory only.
    const latest = new Map<string, string>()

    const rpc = await ctx.rpc.register(ActualModelRpc, {
      getLatest: (rawInput) => {
        const input = rawInput as { sessionID?: unknown }
        const sessionID = input.sessionID
        const model = typeof sessionID === "string" ? (latest.get(sessionID) ?? null) : null
        return Promise.resolve({ model })
      },
    })

    const hook = await ctx.session.hook(
      "http.response",
      (event) => {
        if (event.kind !== "primary") return
        if (event.response.body === null) return
        // Clone before OpenCode consumes the original stream.
        let clone: Response
        try {
          clone = event.response.clone()
        } catch {
          return
        }
        void consume(clone, event.sessionID)
      },
      { providerID: "openrouter" },
    )

    function publish(sessionID: string, model: string): void {
      latest.set(sessionID, model)
      void rpc.events.emit("model.selected", { sessionID, model }).catch(() => {})
    }

    async function consume(response: Response, sessionID: string): Promise<void> {
      try {
        const contentType = (response.headers.get("content-type") ?? "").toLowerCase()
        if (contentType.includes("text/event-stream")) {
          const reader = response.body!.getReader()
          const decoder = new TextDecoder()
          let buffer = ""
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const scan = scanSseBuffer(buffer)
            buffer = scan.remainder
            if (scan.model !== undefined) {
              publish(sessionID, scan.model)
              await reader.cancel().catch(() => {})
              return
            }
          }
          return
        }
        // Non-streaming (or unknown) content type: try to parse the whole body as JSON.
        const model = extractModelFromJson(await response.text())
        if (model !== undefined) publish(sessionID, model)
      } catch {
        // Plugin errors must never break generation.
      }
    }

    return async () => {
      await hook.dispose()
      await rpc.dispose()
    }
  },
})
