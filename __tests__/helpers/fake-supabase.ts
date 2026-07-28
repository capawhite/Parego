/**
 * Minimal chainable Supabase client fake for server-action tests.
 *
 * Configure results per table; successive `.from(table)` calls consume queued
 * results in order (the last one repeats). Any builder method chain resolves to
 * the configured `{ data, error, count }`; `single`/`maybeSingle` unwrap arrays.
 */

export type FakeQueryResult = {
  data?: unknown
  error?: unknown
  count?: number | null
}

export type FakeSupabaseConfig = {
  user?: { id: string } | null
  tables?: Record<string, FakeQueryResult | FakeQueryResult[]>
}

function chain(result: FakeQueryResult): unknown {
  const resolved = {
    data: result.data ?? null,
    error: result.error ?? null,
    count: result.count ?? null,
  }
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === "then") {
        return (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
          Promise.resolve(resolved).then(onFulfilled, onRejected)
      }
      if (prop === "single" || prop === "maybeSingle") {
        return async () => ({
          data: Array.isArray(resolved.data) ? (resolved.data[0] ?? null) : resolved.data,
          error: resolved.error,
        })
      }
      return () => new Proxy({}, handler)
    },
  }
  return new Proxy({}, handler)
}

export function fakeSupabase(config: FakeSupabaseConfig = {}) {
  const queues = new Map<string, FakeQueryResult[]>()
  for (const [table, results] of Object.entries(config.tables ?? {})) {
    queues.set(table, Array.isArray(results) ? [...results] : [results])
  }

  return {
    auth: {
      getUser: async () => ({ data: { user: config.user ?? null }, error: null }),
    },
    from(table: string) {
      const queue = queues.get(table)
      const result =
        queue && queue.length > 0
          ? queue.length > 1
            ? queue.shift()!
            : queue[0]
          : { data: null, error: null }
      return chain(result)
    },
    rpc: async () => ({ data: null, error: null }),
  }
}
