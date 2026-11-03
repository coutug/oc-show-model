import { Plugin } from "@opencode/plugin/tui"
import { ActualModelRpc } from "./rpc.ts"

/**
 * TUI part: renders the actual OpenRouter model for the active session in the
 * prompt footer.
 */
export default Plugin.define({
  id: "oc-show-model",
  setup(context) {
    const [state, update] = context.storage.memory("oc-show-model", {
      initial: {} as Record<string, string>,
    })
    const rpc = context.client.rpc(ActualModelRpc)

    const stopEvents = rpc.events.on("model.selected", (event) => {
      const { sessionID, model } = event.data
      if (typeof sessionID !== "string" || typeof model !== "string") return
      update((draft) => {
        draft[sessionID] = model
      })
    })

    // Fetch the persisted value once per session, for sessions restored
    // before any new response arrives.
    const requested = new Set<string>()
    const ensureLatest = (sessionID: string) => {
      if (requested.has(sessionID)) return
      requested.add(sessionID)
      rpc
        .getLatest({ sessionID })
        .then((result) => {
          const model = (result as { model?: string | null } | undefined)?.model
          if (typeof model === "string" && model.length > 0) {
            update((draft) => {
              draft[sessionID] = model
            })
          }
        })
        .catch(() => {})
    }

    const stopSlot = context.ui.slot({
      append: "prompt.footer.status",
      render: (input) => {
        if (input.sessionID === undefined) return null
        const model = state[input.sessionID]
        if (model === undefined) ensureLatest(input.sessionID)
        return model === undefined ? null : <text>→ {model}</text>
      },
    })

    return () => {
      stopSlot()
      stopEvents()
    }
  },
})
