/** Fetches a URL and resolves with its parsed JSON body, rejecting on a non-2xx status. */
export type FetchJson = (
  url: string,
  headers: Record<string, string>,
) => Promise<unknown>;

/** A request that got no answer: the host was unreachable or the timeout passed. */
export class NoAnswerError extends Error {
  readonly url: string;

  constructor(url: string, options: ErrorOptions) {
    super(`request to ${url} failed`, options);
    this.url = url;
  }
}

/** A request answered with a status outside 2xx. */
export class HttpStatusError extends Error {
  readonly url: string;
  readonly status: number;

  constructor(url: string, status: number) {
    super(`HTTP ${status} from ${url}`);
    this.url = url;
    this.status = status;
  }
}

/** FetchJson over the global fetch, with a timeout so an unreachable host cannot stall a scan. */
export function createFetchJson(timeoutMs: number): FetchJson {
  return async (url, headers) => {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    }).catch((error: unknown) => {
      throw new NoAnswerError(url, { cause: error });
    });
    if (!response.ok) {
      throw new HttpStatusError(url, response.status);
    }
    return response.json();
  };
}
