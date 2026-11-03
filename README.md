# oc-show-model

Simple OpenCode V2 plugin that shows the **actual model** returned by OpenRouter
in the TUI prompt footer — useful with `openrouter/auto`, where the configured
model (`openrouter/auto`) hides the real one (e.g. `anthropic/claude-sonnet-4.5`).

## How it works

Observer only — no request or response is ever modified:

1. **Server part** (`src/index.ts`) hooks `http.response` for provider
   `openrouter`, primary requests only. It clones the response, reads the clone
   in the background, and extracts the `model` field from the first SSE chunk
   (or the JSON body for non-streaming responses). The reader is cancelled as
   soon as a model is found; the original stream consumed by OpenCode is never
   touched. The value is kept in an in-memory map (per session) and published
   over RPC.
2. **RPC contract** (`src/rpc.ts`): event `model.selected` plus a
   `getLatest(sessionID)` method so a reopened session can show its last known
   model before the next response.
3. **TUI part** (`src/tui.tsx`) claims `prompt.footer.status` (append) and
   renders:
   - `NULL` — no model observed yet for this session (temporary placeholder,
     will be removed)
   - `→ anthropic/claude-sonnet-4.5` — actual model from the last response

The footer updates after every model call (including tool-call follow-ups), per
session.

## Install (this repo, project-level for testing)

```bash
npm install
```

The repo's own `opencode.json` registers the plugin by absolute path:

```json
{
  "$schema": "https://opencode.ai/v2/config.schema.json",
  "plugins": ["/home/gabriel/Documents/repo/oc-show-model"]
}
```

Start `opencode` inside this repo, send a prompt with `openrouter/auto`, and
watch the footer go from `NULL` to `→ <real model>` when the response starts
streaming.

To use it everywhere, move the `plugins` entry into
`~/.config/opencode/opencode.json`.

## Test

```bash
npm test        # node --test, parser fixtures (SSE chunk boundaries, CRLF, JSON)
npx tsc --noEmit
```

## Known limits

- Only `primary` requests of provider `openrouter` are observed (hardcoded).
- Non-OpenRouter sessions keep showing `NULL`.
- State is in-memory only: after a server restart, a session shows `NULL`
  until its next model response.
- `NULL` is a temporary debug placeholder, to be removed once validated.
