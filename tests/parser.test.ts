import assert from "node:assert/strict"
import { test } from "node:test"
import { extractModelFromJson, pickModel, scanSseBuffer } from "../src/parser.ts"

test("sse: finds model in a single chunk", () => {
  const scan = scanSseBuffer(
    'data: {"id":"gen-1","object":"chat.completion.chunk","model":"anthropic/claude-sonnet-4.5","choices":[]}\n\n',
  )
  assert.equal(scan.model, "anthropic/claude-sonnet-4.5")
  assert.equal(scan.remainder, "")
})

test("sse: handles chunk split mid-line", () => {
  const first = scanSseBuffer('data: {"id":"gen-1","mod')
  assert.equal(first.model, undefined)
  assert.equal(first.remainder, 'data: {"id":"gen-1","mod')
  const second = scanSseBuffer(
    `${first.remainder}el":"google/gemini-2.5-pro","choices":[]}\n`,
  )
  assert.equal(second.model, "google/gemini-2.5-pro")
})

test("sse: keeps a partial line in the remainder across scans", () => {
  const a = scanSseBuffer('data: {"model":"open')
  const b = scanSseBuffer(`${a.remainder}ai/gpt-5.2"}`)
  assert.equal(b.model, undefined)
  assert.equal(b.remainder, 'data: {"model":"openai/gpt-5.2"}')
  const c = scanSseBuffer(`${b.remainder}\ndata: [DONE]\n`)
  assert.equal(c.model, "openai/gpt-5.2")
})

test("sse: handles CRLF separators", () => {
  const scan = scanSseBuffer(
    'data: {"model":"meta-llama/llama-4"}\r\ndata: [DONE]\r\n\r\n',
  )
  assert.equal(scan.model, "meta-llama/llama-4")
  assert.equal(scan.remainder, "")
})

test("sse: handles lone CR separators", () => {
  const scan = scanSseBuffer('data: {"model":"qwen/qwen3"}\rdata: [DONE]\r')
  assert.equal(scan.model, "qwen/qwen3")
  // The "data: [DONE]" line ends with an ambiguous trailing lone CR, so it stays in the remainder.
  assert.equal(scan.remainder, "data: [DONE]\r")
})

test("sse: ignores comments, [DONE], empty and invalid payloads", () => {
  const scan = scanSseBuffer(
    ": keep-alive\n\ndata: [DONE]\n\ndata: not json\n\ndata: {}\n\n",
  )
  assert.equal(scan.model, undefined)
})

test("sse: ignores empty and non-string model values", () => {
  const scan = scanSseBuffer('data: {"model":""}\n\ndata: {"model":42}\n')
  assert.equal(scan.model, undefined)
})

test("sse: finds model on a later data line", () => {
  const scan = scanSseBuffer(
    'data: {"object":"chat.completion.chunk","choices":[{"delta":{"role":"assistant"}}]}\n\ndata: {"model":"mistralai/mistral-large"}\n',
  )
  assert.equal(scan.model, "mistralai/mistral-large")
})

test("sse: reads nested response.model (Responses API event)", () => {
  const scan = scanSseBuffer(
    'data: {"type":"response.completed","response":{"model":"openai/o4-mini"}}\n',
  )
  assert.equal(scan.model, "openai/o4-mini")
})

test("json: extracts model from a non-streaming body", () => {
  assert.equal(
    extractModelFromJson('{"id":"gen-9","model":"x-ai/grok-4","choices":[]}'),
    "x-ai/grok-4",
  )
})

test("json: returns undefined for garbage or model-less bodies", () => {
  assert.equal(extractModelFromJson("not json"), undefined)
  assert.equal(extractModelFromJson('{"error":{"message":"rate limited"}}'), undefined)
  assert.equal(extractModelFromJson(""), undefined)
})

test("pickModel: never returns empty or non-string values", () => {
  assert.equal(pickModel(null), undefined)
  assert.equal(pickModel("string"), undefined)
  assert.equal(pickModel({ model: "" }), undefined)
  assert.equal(pickModel({ model: 3 }), undefined)
  assert.equal(pickModel({ response: { model: null } }), undefined)
  assert.equal(pickModel({ model: "deepseek/deepseek-chat" }), "deepseek/deepseek-chat")
})
