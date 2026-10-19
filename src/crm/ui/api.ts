/** Browser-side fetch wrapper for the CRM API: JSON in/out, readable errors, 401 → sign-in. */
export async function crmFetch<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  const form = typeof FormData !== "undefined" && opts.body instanceof FormData;
  try {
    res = await fetch(path, {
      method: opts.method ?? "GET",
      headers: opts.body !== undefined && !form ? { "Content-Type": "application/json" } : undefined,
      body: opts.body === undefined ? undefined : form ? (opts.body as FormData) : JSON.stringify(opts.body),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new Error("Can't reach the server. Check your connection and try again.");
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; restart?: boolean };
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status}).`) as Error & { status: number; restart?: boolean };
    err.status = res.status;
    err.restart = data.restart;
    throw err;
  }
  return data as T;
}
