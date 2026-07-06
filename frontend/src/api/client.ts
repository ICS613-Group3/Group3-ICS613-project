// Fetch wrapper with Bearer auth, token refresh, and error handling.
// When VITE_USE_MOCKS=true, short-circuits to mock handlers.

import type {
  RefreshRequest,
  TokenPairResponse,
} from '../types/api';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

const TOKEN_STORAGE_KEY = 'access_token';
const REFRESH_STORAGE_KEY = 'refresh_token';

export class ApiRequestError extends Error {
  status: number;
  errorCode: string;
  detail: string;

  constructor(status: number, errorCode: string, detail: string) {
    super(detail);
    this.name = 'ApiRequestError';
    this.status = status;
    this.errorCode = errorCode;
    this.detail = detail;
  }
}

// ── Token helpers ──────────────────────────────────────────────────────

function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_STORAGE_KEY);
}

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, access);
  localStorage.setItem(REFRESH_STORAGE_KEY, refresh);
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(REFRESH_STORAGE_KEY);
}

export function hasTokens(): boolean {
  return !!getAccessToken();
}

// ── URL builder ────────────────────────────────────────────────────────

function buildUrl(path: string): string {
  // If using mocks, return path as-is (handlers match on exact path).
  if (USE_MOCKS) return path;
  // Ensure path starts with / so we don't lose it.
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
}

// ── Mock dispatch ──────────────────────────────────────────────────────

async function handleMock(
  method: string,
  path: string,
  body: unknown,
  headers: Record<string, string>,
): Promise<Response> {
  const { matchMock } = await import('../mocks/handlers');
  const result = await matchMock(method, path, body, headers);
  return new Response(JSON.stringify(result[0]), {
    status: result[1],
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Core request ───────────────────────────────────────────────────────

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const body: RefreshRequest = { refresh_token: refreshToken };
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      clearTokens();
      return null;
    }

    const data: TokenPairResponse = await res.json();
    setTokens(data.access_token, data.refresh_token);
    return data.access_token;
  } catch {
    clearTokens();
    return null;
  }
}

export async function apiRequest<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  options?: { isFormData?: boolean },
): Promise<T> {
  // Mock mode: short-circuit.
  if (USE_MOCKS) {
    const headers: Record<string, string> = {};
    const accessToken = getAccessToken();
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    const res = await handleMock(method, path, body, headers);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Mock error' }));
      throw new ApiRequestError(
        res.status,
        err.error_code || 'MockError',
        err.detail || 'Mock error',
      );
    }
    if (res.status === 204) return undefined as T;
    return res.json();
  }

  const url = buildUrl(path);
  let accessToken = getAccessToken();

  const makeRequest = async (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!options?.isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (body !== undefined) {
      fetchOptions.body = options?.isFormData
        ? (body as FormData)
        : JSON.stringify(body);
    }

    return fetch(url, fetchOptions);
  };

  let res = await makeRequest(accessToken);

  // On 401, try refreshing the token once.
  if (res.status === 401 && accessToken) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      accessToken = newToken;
      res = await makeRequest(accessToken);
    }
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({
      detail: 'Unknown error',
      error_code: 'UnknownError',
    }));
    throw new ApiRequestError(
      res.status,
      errBody.error_code || 'UnknownError',
      errBody.detail || 'Unknown error',
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
