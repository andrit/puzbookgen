/**
 * @file api/claude.client.ts
 * @description Thin wrapper around the Anthropic /v1/messages endpoint.
 *
 * Single responsibility: send a prompt, return the raw text response.
 * No JSON parsing, no retry logic — those live in their own modules.
 *
 * Throws ApiError on non-2xx responses so callers can handle failures
 * explicitly rather than receiving an empty or malformed string.
 */

import { ApiError } from '../types'

const API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL   = 'claude-sonnet-4-20250514'
const MAX_TOKENS = 4000
const API_VERSION = '2023-06-01'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * callClaude — sends a system + user prompt to the Claude API.
 *
 * @param system  System prompt (stable instructions)
 * @param user    User message (theme-specific content)
 * @param apiKey  Anthropic API key — falls back to ANTHROPIC_API_KEY env var
 * @returns       Raw text content from the first content block
 * @throws        ApiError on non-2xx HTTP responses
 * @throws        Error if no text content block is found in the response
 */
export async function callClaude(
  system:  string,
  user:    string,
  apiKey?: string
): Promise<string> {
  const key = apiKey ?? process.env.ANTHROPIC_API_KEY ?? ''

  if (!key) {
    throw new Error(
      'No API key provided. Pass apiKey or set ANTHROPIC_API_KEY env var.'
    )
  }

  const response = await fetch(API_URL, {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         key,
      'anthropic-version': API_VERSION,
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new ApiError(
      `Claude API error ${response.status}: ${response.statusText}`,
      response.status,
      body
    )
  }

  const data = await response.json() as {
    content: Array<{ type: string; text?: string }>
  }

  const textBlock = data.content.find(block => block.type === 'text')

  if (!textBlock?.text) {
    throw new Error('Claude API returned no text content block.')
  }

  return textBlock.text
}

// ---------------------------------------------------------------------------
// Exported constants (for tests and mocks)
// ---------------------------------------------------------------------------

export { MODEL, MAX_TOKENS, API_URL, API_VERSION }
