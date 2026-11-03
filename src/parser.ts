/**
 * Pure helpers extracting the actual model identifier from an OpenRouter response.
 *
 * No OpenCode imports here: everything is testable with plain Node.
 */

export interface SseScanResult {
  /** First model identifier found in complete SSE lines, if any. */
  readonly model?: string
  /** Incomplete trailing text to prepend to the next chunk. */
  readonly remainder: string
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
}

/**
 * Pick a model identifier from a parsed payload.
 * Covers Chat Completions chunks (`payload.model`) and Responses API events
 * (`payload.response.model`). Never returns an empty or non-string value.
 */
export function pickModel(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null) return undefined
  const record = payload as Record<string, unknown>
  if (nonEmptyString(record.model)) return record.model
  const response = record.response
  if (typeof response === "object" && response !== null) {
    const inner = (response as Record<string, unknown>).model
    if (nonEmptyString(inner)) return inner
  }
  return undefined
}

/** Parse a complete non-streaming JSON body and return its `model`, if valid. */
export function extractModelFromJson(text: string): string | undefined {
  try {
    return pickModel(JSON.parse(text))
  } catch {
    return undefined
  }
}

/**
 * Scan accumulated SSE text for the first `data:` line carrying a model.
 * Handles `\n`, `\r\n`, lone `\r`, arbitrary chunk boundaries and `[DONE]`.
 */
export function scanSseBuffer(buffer: string): SseScanResult {
  // End index of the last complete line (past its terminator).
  let completeEnd = -1
  let i = 0
  while (i < buffer.length) {
    const char = buffer[i]
    if (char === "\r") {
      // A trailing "\r" is ambiguous (lone CR vs pending CRLF): keep it in the remainder.
      if (i === buffer.length - 1) break
      completeEnd = i + (buffer[i + 1] === "\n" ? 2 : 1)
      i = completeEnd
    } else if (char === "\n") {
      completeEnd = i + 1
      i++
    } else {
      i++
    }
  }
  if (completeEnd === -1) return { remainder: buffer }
  return {
    model: scanSseLines(buffer.slice(0, completeEnd)),
    remainder: buffer.slice(completeEnd),
  }
}

function scanSseLines(text: string): string | undefined {
  const lines = text.split(/\r\n|\r|\n/)
  for (const line of lines) {
    if (!line.startsWith("data:")) continue
    const payload = line.slice("data:".length)
    const trimmed = payload.startsWith(" ") ? payload.slice(1) : payload
    if (trimmed.length === 0 || trimmed === "[DONE]") continue
    let json: unknown
    try {
      json = JSON.parse(trimmed)
    } catch {
      continue
    }
    const model = pickModel(json)
    if (model !== undefined) return model
  }
  return undefined
}
