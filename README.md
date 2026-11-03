# oc-show-model

OpenCode plugin that displays the actual model used by OpenRouter in the TUI prompt footer, useful with `openrouter/auto`.

## Install

```sh
opencode plugin add github:coutug/oc-show-model
```

Or pin a release in `opencode.json`:

```json
{ "plugins": ["github:coutug/oc-show-model#v0.1.0"] }
```

See [Releases](https://github.com/coutug/oc-show-model/releases) for available versions.

## How it works

The plugin observes cloned primary OpenRouter responses, reads the model from the SSE or JSON response without changing the original, and keeps the latest model in memory per session. It sends the model to the TUI, which shows `→ <model>` in the footer. The footer stays empty until a model is found.
