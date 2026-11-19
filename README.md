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

## Dependabot releases

Merged Dependabot pull requests trigger a patch release after tests pass. The
workflow updates the package versions, pushes a commit and matching tag to
`main`, and creates a GitHub release. It requires permission to push to `main`.
Changes pushed with `GITHUB_TOKEN` do not trigger other workflows.

If a release fails, inspect the workflow before rerunning it; a rerun resumes
the same pull request's release rather than incrementing again. Resolve any
draft or incomplete release before processing another pull request. If the
released commit needs a fix, release the fix as a new version rather than
rerunning the original pull request's workflow or reusing its tag. Manual
releases must not run concurrently with an automated release.

## How it works

The plugin observes cloned primary OpenRouter responses, reads the model from the SSE or JSON response without changing the original, and keeps the latest model in memory per session. It sends the model to the TUI, which shows `→ <model>` in the footer. The footer stays empty until a model is found.
