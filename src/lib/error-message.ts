/**
 * Server-function failures do not arrive as `Error` instances — they cross the
 * RPC boundary as plain objects, so `String(cause)` renders "[object Object]"
 * and hides whatever actually went wrong. Dig for a human-readable message,
 * and fall back to the serialised payload rather than to nothing.
 */
export function errorMessage(cause: unknown): string {
  const seen = new Set<unknown>()

  function walk(value: unknown, depth: number): string | null {
    if (typeof value === 'string') return value.trim() || null
    if (typeof value !== 'object' || value === null || depth > 4) return null
    if (seen.has(value)) return null
    seen.add(value)

    if (value instanceof Error && value.message) return value.message

    const record = value as Record<string, unknown>
    for (const key of ['message', 'error', 'reason', 'detail', 'statusText', 'body', 'data']) {
      const found = walk(record[key], depth + 1)
      if (found) return found
    }
    return null
  }

  const message = walk(cause, 0)
  if (message) return message

  try {
    const serialised = JSON.stringify(cause)
    if (serialised && serialised !== '{}' && serialised !== 'null') {
      return serialised.length > 400 ? `${serialised.slice(0, 400)}…` : serialised
    }
  } catch {
    // circular — nothing useful to show
  }
  return 'Unknown error (see server logs)'
}
