/**
 * @file api/claude.client.test.ts
 * @description Unit tests for callClaude. All HTTP calls are mocked —
 * no real API calls are made in this test file.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { callClaude, MODEL, MAX_TOKENS, API_URL, API_VERSION } from './claude.client'
import { ApiError } from '../types'

// ---------------------------------------------------------------------------
// Mock fetch globally
// ---------------------------------------------------------------------------

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeResponse = (
  body: object,
  status = 200,
  ok = true
): Response => ({
  ok,
  status,
  statusText: ok ? 'OK' : 'Bad Request',
  json:  () => Promise.resolve(body),
  text:  () => Promise.resolve(JSON.stringify(body)),
} as unknown as Response)

const successResponse = (text = 'Hello from Claude') =>
  makeResponse({ content: [{ type: 'text', text }] })

const errorResponse = (status: number, body = 'error body') => ({
  ok:         false,
  status,
  statusText: 'Error',
  text:       () => Promise.resolve(body),
  json:       () => Promise.resolve({}),
} as unknown as Response)

// ---------------------------------------------------------------------------
// Request construction
// ---------------------------------------------------------------------------

describe('callClaude — request construction', () => {
  it('calls the correct API URL', async () => {
    mockFetch.mockResolvedValueOnce(successResponse())
    await callClaude('sys', 'user', 'test-key')
    expect(mockFetch).toHaveBeenCalledWith(API_URL, expect.any(Object))
  })

  it('sends POST method', async () => {
    mockFetch.mockResolvedValueOnce(successResponse())
    await callClaude('sys', 'user', 'test-key')
    const [, init] = mockFetch.mock.calls[0]
    expect(init.method).toBe('POST')
  })

  it('sends correct Content-Type header', async () => {
    mockFetch.mockResolvedValueOnce(successResponse())
    await callClaude('sys', 'user', 'test-key')
    const [, init] = mockFetch.mock.calls[0]
    expect(init.headers['Content-Type']).toBe('application/json')
  })

  it('sends API key in x-api-key header', async () => {
    mockFetch.mockResolvedValueOnce(successResponse())
    await callClaude('sys', 'user', 'sk-test-123')
    const [, init] = mockFetch.mock.calls[0]
    expect(init.headers['x-api-key']).toBe('sk-test-123')
  })

  it('sends correct anthropic-version header', async () => {
    mockFetch.mockResolvedValueOnce(successResponse())
    await callClaude('sys', 'user', 'test-key')
    const [, init] = mockFetch.mock.calls[0]
    expect(init.headers['anthropic-version']).toBe(API_VERSION)
  })

  it('sends the correct model in the request body', async () => {
    mockFetch.mockResolvedValueOnce(successResponse())
    await callClaude('sys', 'user', 'test-key')
    const [, init] = mockFetch.mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body.model).toBe(MODEL)
  })

  it('sends max_tokens in the request body', async () => {
    mockFetch.mockResolvedValueOnce(successResponse())
    await callClaude('sys', 'user', 'test-key')
    const [, init] = mockFetch.mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body.max_tokens).toBe(MAX_TOKENS)
  })

  it('sends system prompt as top-level system field', async () => {
    mockFetch.mockResolvedValueOnce(successResponse())
    await callClaude('my system prompt', 'user msg', 'test-key')
    const [, init] = mockFetch.mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body.system).toBe('my system prompt')
  })

  it('sends user message as messages[0].content', async () => {
    mockFetch.mockResolvedValueOnce(successResponse())
    await callClaude('sys', 'my user message', 'test-key')
    const [, init] = mockFetch.mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body.messages[0].role).toBe('user')
    expect(body.messages[0].content).toBe('my user message')
  })
})

// ---------------------------------------------------------------------------
// API key resolution
// ---------------------------------------------------------------------------

describe('callClaude — API key resolution', () => {
  it('uses provided apiKey over env var', async () => {
    process.env.ANTHROPIC_API_KEY = 'env-key'
    mockFetch.mockResolvedValueOnce(successResponse())
    await callClaude('sys', 'user', 'explicit-key')
    const [, init] = mockFetch.mock.calls[0]
    expect(init.headers['x-api-key']).toBe('explicit-key')
    delete process.env.ANTHROPIC_API_KEY
  })

  it('falls back to ANTHROPIC_API_KEY env var when no key provided', async () => {
    process.env.ANTHROPIC_API_KEY = 'env-key-fallback'
    mockFetch.mockResolvedValueOnce(successResponse())
    await callClaude('sys', 'user')
    const [, init] = mockFetch.mock.calls[0]
    expect(init.headers['x-api-key']).toBe('env-key-fallback')
    delete process.env.ANTHROPIC_API_KEY
  })

  it('throws when no key provided and env var is not set', async () => {
    const saved = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    await expect(callClaude('sys', 'user')).rejects.toThrow(/No API key/)
    if (saved) process.env.ANTHROPIC_API_KEY = saved
  })
})

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

describe('callClaude — response parsing', () => {
  it('returns the text from the first text content block', async () => {
    mockFetch.mockResolvedValueOnce(successResponse('Generated words here'))
    const result = await callClaude('sys', 'user', 'key')
    expect(result).toBe('Generated words here')
  })

  it('returns text when content has multiple blocks', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({
      content: [
        { type: 'thinking', thinking: 'let me think...' },
        { type: 'text', text: 'The answer' },
      ],
    }))
    const result = await callClaude('sys', 'user', 'key')
    expect(result).toBe('The answer')
  })

  it('throws when response has no text content block', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({
      content: [{ type: 'tool_use', id: 'xyz' }],
    }))
    await expect(callClaude('sys', 'user', 'key')).rejects.toThrow(/no text content/)
  })

  it('throws when content array is empty', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ content: [] }))
    await expect(callClaude('sys', 'user', 'key')).rejects.toThrow(/no text content/)
  })
})

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('callClaude — error handling', () => {
  it('throws ApiError on 400 response', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(400, '{"error":"bad request"}'))
    await expect(callClaude('sys', 'user', 'key')).rejects.toThrow(ApiError)
  })

  it('throws ApiError on 401 response', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(401, 'Unauthorized'))
    try {
      await callClaude('sys', 'user', 'bad-key')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).status).toBe(401)
    }
  })

  it('throws ApiError on 429 rate limit response', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(429, 'Rate limited'))
    await expect(callClaude('sys', 'user', 'key')).rejects.toThrow(ApiError)
  })

  it('throws ApiError on 500 server error', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(500, 'Internal Server Error'))
    try {
      await callClaude('sys', 'user', 'key')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).status).toBe(500)
    }
  })

  it('includes the response body in ApiError', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(400, '{"error":"invalid_request"}'))
    try {
      await callClaude('sys', 'user', 'key')
    } catch (e) {
      expect((e as ApiError).body).toContain('invalid_request')
    }
  })

  it('includes the status code in ApiError message', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(403, 'Forbidden'))
    try {
      await callClaude('sys', 'user', 'key')
    } catch (e) {
      expect((e as ApiError).message).toContain('403')
    }
  })

  it('ApiError has correct name property', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(500, 'oops'))
    try {
      await callClaude('sys', 'user', 'key')
    } catch (e) {
      expect((e as ApiError).name).toBe('ApiError')
    }
  })
})

// ---------------------------------------------------------------------------
// Exported constants are the expected values
// ---------------------------------------------------------------------------

describe('callClaude — exported constants', () => {
  it('MODEL is claude-sonnet-4-20250514', () => {
    expect(MODEL).toBe('claude-sonnet-4-20250514')
  })

  it('MAX_TOKENS is 4000', () => {
    expect(MAX_TOKENS).toBe(4000)
  })

  it('API_URL points to Anthropic messages endpoint', () => {
    expect(API_URL).toBe('https://api.anthropic.com/v1/messages')
  })
})
