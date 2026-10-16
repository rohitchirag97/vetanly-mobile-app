import { API_URL } from '@/lib/config';
import { setItem } from '@/lib/storage';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
};

type ApiResponse<T> = { status: 'success' | 'error'; message: string; data: T };

// Held in memory so requests don't read secure storage each time; the session provider loads and clears them.
let tokens: { accessToken: string; refreshToken: string } | null = null;
let onSessionExpired: () => void = () => {};
let refreshRequest: Promise<string> | null = null;

export const setTokens = (next: typeof tokens) => {
  tokens = next;
};

export const setOnSessionExpired = (handler: () => void) => {
  onSessionExpired = handler;
};

const expire = (message = 'Your session has expired. Please sign in again.') => {
  tokens = null;
  onSessionExpired();
  return new ApiError(message, 401);
};

const refreshAccessToken = (): Promise<string> => {
  refreshRequest ??= (async () => {
    if (!tokens) throw expire();
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });
    const json = (await res.json().catch(() => null)) as ApiResponse<{ accessToken?: string }> | null;
    const accessToken = json?.data?.accessToken;
    // Only a rejected refresh token ends the session; a server error or outage should not sign the user out.
    if (res.status === 401) throw expire(json?.message);
    if (!res.ok || typeof accessToken !== 'string') {
      throw new ApiError(json?.message ?? 'Could not refresh your session', res.status);
    }
    tokens = { ...tokens, accessToken };
    await setItem('accessToken', accessToken);
    return accessToken;
  })().finally(() => {
    refreshRequest = null;
  });
  return refreshRequest;
};

export async function api<T = unknown>(
  path: string,
  { method = 'GET', body, auth = false }: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const send = (accessToken?: string) =>
    fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  let res: Response;
  try {
    const sentToken = auth ? tokens?.accessToken : undefined;
    res = await send(sentToken);
    if (res.status === 401 && auth) {
      // Another request may already have refreshed the token while this one was in flight.
      const current = tokens?.accessToken;
      res = await send(current && current !== sentToken ? current : await refreshAccessToken());
      if (res.status === 401) throw expire();
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0);
  }

  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!res.ok || !json) throw new ApiError(json?.message ?? 'Something went wrong', res.status);
  return json;
}
