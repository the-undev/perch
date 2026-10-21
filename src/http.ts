/** Fetches a URL and resolves with its parsed JSON body, rejecting on a non-2xx status. */
export type FetchJson = (
  url: string,
  headers: Record<string, string>,
) => Promise<unknown>;

/** FetchJson over the global fetch, with a timeout so an unreachable host cannot stall a scan. */
export function createFetchJson(timeoutMs: number): FetchJson {
  return async (url, headers) => {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText} from ${url}`);
    }
    return response.json();
  };
}
