/**
 * API client.
 *
 * Centralizes every backend call so individual pages stay focused on UI.
 *
 * Key responsibilities:
 * - Attach the bearer token to every protected request.
 * - On 401, try to refresh the access token once and retry the original request.
 *   If refresh also fails, clear tokens and let the caller handle the 401.
 * - Convert non-2xx responses into thrown ``ApiError``s with the backend's
 *   ``detail`` message and ``error_code`` for the UI to display.
 * - Expose typed helpers for each resource (tools, reservations, reviews, ...).
 *
 * Backend base URL is read from ``VITE_API_BASE_URL`` (see .env).
 */

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  'http://localhost:8000/api/v1';

const TOKEN_KEY = 'auth_access_token';
const REFRESH_KEY = 'auth_refresh_token';

// --------------------------------------------------------------------------
// Error type
// --------------------------------------------------------------------------

export class ApiError extends Error {
  status: number;
  errorCode: string;
  details: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    errorCode = 'UnknownError',
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errorCode = errorCode;
    this.details = details;
  }
}

// --------------------------------------------------------------------------
// Token storage
// --------------------------------------------------------------------------

export const tokenStore = {
  getAccess: (): string | null => localStorage.getItem(TOKEN_KEY),
  getRefresh: (): string | null => localStorage.getItem(REFRESH_KEY),
  set(access: string, refresh: string): void {
    localStorage.setItem(TOKEN_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
  hasAccess: (): boolean => Boolean(localStorage.getItem(TOKEN_KEY)),
};

// --------------------------------------------------------------------------
// Low-level fetch with auto-refresh
// --------------------------------------------------------------------------

async function rawFetch(
  path: string,
  init: RequestInit & { skipAuth?: boolean; skipRefresh?: boolean } = {},
): Promise<Response> {
  const headers = new Headers(init.headers ?? {});
  if (!init.skipAuth) {
    const access = tokenStore.getAccess();
    if (access) headers.set('Authorization', `Bearer ${access}`);
  }
  // Let the browser set the Content-Type for FormData (with boundary).
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
}

async function parseError(response: Response): Promise<ApiError> {
  let message = `Request failed with status ${response.status}`;
  let errorCode = 'UnknownError';
  let details: Record<string, unknown> = {};
  try {
    const body = await response.json();
    if (typeof body === 'object' && body !== null) {
      if (typeof body.detail === 'string') message = body.detail;
      if (typeof body.error_code === 'string') errorCode = body.error_code;
      const { detail, error_code, ...rest } = body;
      void detail;
      void error_code;
      details = rest as Record<string, unknown>;
    }
  } catch {
    // body wasn't JSON — fall back to status text
  }
  return new ApiError(message, response.status, errorCode, details);
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  // Coalesce concurrent 401s — only one refresh at a time.
  if (refreshInFlight) return refreshInFlight;
  const refresh = tokenStore.getRefresh();
  if (!refresh) return false;

  refreshInFlight = (async () => {
    try {
      const res = await rawFetch(
        '/auth/refresh',
        {
          method: 'POST',
          body: JSON.stringify({ refresh_token: refresh }),
          skipAuth: true,
        },
      );
      if (!res.ok) {
        tokenStore.clear();
        return false;
      }
      const body = (await res.json()) as { access_token: string; refresh_token: string };
      tokenStore.set(body.access_token, body.refresh_token);
      return true;
    } catch {
      tokenStore.clear();
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function request<T>(
  path: string,
  init: RequestInit & { skipAuth?: boolean; skipRefresh?: boolean } = {},
): Promise<T> {
  const response = await rawFetch(path, init);
  if (response.status === 401 && !init.skipRefresh) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const retry = await rawFetch(path, init);
      if (!retry.ok) throw await parseError(retry);
      return (await retry.json()) as T;
    }
  }
  if (!response.ok) throw await parseError(response);
  // 204 No Content
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// --------------------------------------------------------------------------
// Auth endpoints
// --------------------------------------------------------------------------

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  bio: string | null;
  neighborhood: string | null;
  photo_url: string | null;
  status: 'EMAIL_PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  trust_score: number;
  damage_reported: number;
  violation_count: number;
  created_at: string;
  is_admin: boolean;
}

export const authApi = {
  async login(email: string, password: string): Promise<TokenPair> {
    return request<TokenPair>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuth: true,
    });
  },
  async register(input: {
    email: string;
    password: string;
    full_name?: string;
    invite_token: string;
  }): Promise<{ message: string }> {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
      skipAuth: true,
    });
  },
  async logout(): Promise<void> {
    await request('/auth/logout', { method: 'POST' });
  },
  async me(): Promise<UserProfile> {
    return request<UserProfile>('/auth/me');
  },
  async updateMe(input: {
    full_name?: string | null;
    bio?: string | null;
    neighborhood?: string | null;
    photo_url?: string | null;
  }): Promise<UserProfile> {
    return request<UserProfile>('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },
  async deleteMe(): Promise<void> {
    await request<void>('/auth/me', { method: 'DELETE' });
  },
  async verifyEmail(token: string): Promise<TokenPair> {
    return request<TokenPair>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
      skipAuth: true,
    });
  },
  async resendVerification(email: string): Promise<{ message: string }> {
    return request('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
      skipAuth: true,
    });
  },
  async forgotPassword(email: string): Promise<{ message: string }> {
    return request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
      skipAuth: true,
    });
  },
  async resetPassword(token: string, newPassword: string): Promise<TokenPair> {
    return request<TokenPair>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, new_password: newPassword }),
      skipAuth: true,
    });
  },
};

// --------------------------------------------------------------------------
// Tool endpoints
// --------------------------------------------------------------------------

export type ToolCategory =
  | 'HAND_TOOLS'
  | 'POWER_TOOLS'
  | 'GARDEN_TOOLS'
  | 'CLEANING_TOOLS'
  | 'OUTDOOR_GEAR';

export type ToolCondition = 'NEW' | 'LIKE_NEW' | 'GOOD' | 'FAIR' | 'POOR';

export interface ToolPhoto {
  id: string;
  url: string;
  display_order: number;
}

export interface ToolOwner {
  id: string;
  full_name: string | null;
  photo_url: string | null;
}

export interface Tool {
  id: string;
  owner_id: string;
  owner: ToolOwner;
  name: string;
  description: string | null;
  category: ToolCategory;
  condition: ToolCondition;
  is_active: boolean;
  deactivated_by: 'OWNER' | 'ADMIN' | null;
  deactivated_at: string | null;
  deactivation_reason: string | null;
  avg_rating: number;
  rating_count: number;
  photos: ToolPhoto[];
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export const toolsApi = {
  async list(params: {
    category?: ToolCategory;
    search?: string;
    available_start?: string;
    available_end?: string;
    page?: number;
    page_size?: number;
  } = {}): Promise<PaginatedResponse<Tool>> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<PaginatedResponse<Tool>>(`/tools${suffix}`);
  },
  async listMy(params: { page?: number; page_size?: number } = {}): Promise<PaginatedResponse<Tool>> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      appendIfPresent(qs, k, v);
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<PaginatedResponse<Tool>>(`/tools/me${suffix}`);
  },
  async get(id: string): Promise<Tool> {
    return request<Tool>(`/tools/${id}`);
  },
  async create(input: {
    name: string;
    category: ToolCategory;
    condition: ToolCondition;
    description?: string;
    photos?: File[];
  }): Promise<Tool> {
    const form = new FormData();
    form.append('name', input.name);
    form.append('category', input.category);
    form.append('condition', input.condition);
    if (input.description) form.append('description', input.description);
    if (input.photos) {
      for (const file of input.photos) form.append('photos', file);
    }
    return request<Tool>('/tools', { method: 'POST', body: form });
  },
  async update(
    id: string,
    input: {
      name?: string;
      description?: string;
      category?: ToolCategory;
      condition?: ToolCondition;
    },
  ): Promise<Tool> {
    return request<Tool>(`/tools/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },
  async delete(id: string): Promise<void> {
    await request<void>(`/tools/${id}`, { method: 'DELETE' });
  },
  async deactivate(id: string, reason: string): Promise<Tool> {
    return request<Tool>(`/tools/${id}/deactivate`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },
  async reactivate(id: string): Promise<Tool> {
    return request<Tool>(`/tools/${id}/reactivate`, { method: 'POST' });
  },
  async addPhotos(id: string, photos: File[]): Promise<Tool> {
    const form = new FormData();
    for (const file of photos) form.append('photos', file);
    return request<Tool>(`/tools/${id}/photos`, { method: 'POST', body: form });
  },
  async removePhoto(toolId: string, photoId: string): Promise<void> {
    await request<void>(`/tools/${toolId}/photos/${photoId}`, { method: 'DELETE' });
  },
};

// --------------------------------------------------------------------------
// Reservation endpoints
// --------------------------------------------------------------------------

export type ReservationState =
  | 'REQUESTED'
  | 'APPROVED'
  | 'PICKED_UP'
  | 'RETURNED'
  | 'DENIED'
  | 'CANCELLED';

export interface Reservation {
  id: string;
  tool_id: string;
  borrower_id: string;
  state: ReservationState;
  start_date: string;
  end_date: string;
  cancelled_by_type: 'borrower' | 'owner' | 'system' | 'admin' | null;
  cancelled_reason: string | null;
  denied_reason: string | null;
  picked_up_at: string | null;
  returned_at: string | null;
  damage_reported: boolean;
  damage_description: string | null;
  damage_reported_at: string | null;
  force_resolved_by: string | null;
  force_resolved_at: string | null;
  force_resolution_reason: string | null;
  created_at: string;
  updated_at: string;
}

export const reservationsApi = {
  async list(params: {
    role?: 'borrower' | 'owner';
    state?: ReservationState;
    page?: number;
    page_size?: number;
  } = {}): Promise<PaginatedResponse<Reservation>> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      appendIfPresent(qs, k, v);
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<PaginatedResponse<Reservation>>(`/reservations${suffix}`);
  },
  async get(id: string): Promise<Reservation> {
    return request<Reservation>(`/reservations/${id}`);
  },
  async create(input: {
    tool_id: string;
    start_date: string;
    end_date: string;
  }): Promise<Reservation> {
    return request<Reservation>('/reservations', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  async approve(id: string): Promise<Reservation> {
    return request<Reservation>(`/reservations/${id}/approve`, { method: 'POST' });
  },
  async deny(id: string, reason?: string): Promise<Reservation> {
    return request<Reservation>(`/reservations/${id}/deny`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason ?? null }),
    });
  },
  async cancel(id: string, reason: string): Promise<Reservation> {
    return request<Reservation>(`/reservations/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },
  async markPickedUp(id: string): Promise<Reservation> {
    return request<Reservation>(`/reservations/${id}/mark-picked-up`, { method: 'POST' });
  },
  async markReturned(id: string): Promise<Reservation> {
    return request<Reservation>(`/reservations/${id}/mark-returned`, { method: 'POST' });
  },
  async markDamaged(id: string, description: string): Promise<Reservation> {
    return request<Reservation>(`/reservations/${id}/mark-damaged`, {
      method: 'POST',
      body: JSON.stringify({ description }),
    });
  },
  async adminForceReturn(id: string, reason: string): Promise<Reservation> {
    return request<Reservation>(`/reservations/${id}/admin-force-return`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },
};

// --------------------------------------------------------------------------
// Review endpoints
// --------------------------------------------------------------------------

export interface Review {
  id: string;
  reservation_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export const reviewsApi = {
  async create(reservationId: string, input: { rating: number; comment?: string }): Promise<Review> {
    return request<Review>(`/reservations/${reservationId}/review`, {
      method: 'POST',
      body: JSON.stringify({ rating: input.rating, comment: input.comment ?? null }),
    });
  },
  async listForReservation(reservationId: string): Promise<Review[]> {
    return request<Review[]>(`/reservations/${reservationId}/review`);
  },
};

// --------------------------------------------------------------------------
// Notification endpoints
// --------------------------------------------------------------------------

export type NotificationType =
  | 'INVITE_SENT'
  | 'EMAIL_VERIFIED'
  | 'PASSWORD_RESET'
  | 'RESERVATION_REQUESTED'
  | 'RESERVATION_APPROVED'
  | 'RESERVATION_DENIED'
  | 'RESERVATION_CANCELLED'
  | 'RESERVATION_PICKED_UP'
  | 'RESERVATION_RETURNED'
  | 'RESERVATION_OVERDUE'
  | 'TOOL_DEACTIVATED'
  | 'TOOL_REACTIVATED'
  | 'ACCOUNT_SUSPENDED'
  | 'ACCOUNT_REACTIVATED';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationListResponse {
  items: Notification[];
  total: number;
  unread_count: number;
  page: number;
  page_size: number;
  pages: number;
}

export const notificationsApi = {
  async list(params: { unread_only?: boolean; page?: number; page_size?: number } = {}): Promise<NotificationListResponse> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      appendIfPresent(qs, k, v);
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<NotificationListResponse>(`/notifications${suffix}`);
  },
  async markRead(id: string): Promise<Notification> {
    return request<Notification>(`/notifications/${id}/read`, { method: 'POST' });
  },
};

// --------------------------------------------------------------------------
// Admin endpoints (R1.C: audit log + R1.A: invite management)
// --------------------------------------------------------------------------

export interface Invite {
  id: string;
  token: string;
  email: string;
  status: 'sent' | 'used' | 'expired' | 'revoked';
  expires_at: string;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  action_type: string;
  target_type: string;
  target_id: string;
  reason: string;
  // Backend serializes ``metadata_`` as ``metadata`` to avoid clashing
  // with Pydantic's reserved ``metadata`` alias.
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export const adminApi = {
  async listInvites(): Promise<Invite[]> {
    return request<Invite[]>('/auth/invites');
  },
  async createInvite(email: string): Promise<Invite> {
    return request<Invite>('/auth/invites', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },
  async listAuditLog(params: {
    action_type?: string;
    target_type?: string;
    page?: number;
    page_size?: number;
  } = {}): Promise<PaginatedResponse<AuditLogEntry>> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      appendIfPresent(qs, k, v);
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<PaginatedResponse<AuditLogEntry>>(`/admin/audit-log${suffix}`);
  },
  async listAllTools(params: {
    status?: 'active' | 'inactive';
    category?: ToolCategory;
    search?: string;
    page?: number;
    page_size?: number;
  } = {}): Promise<PaginatedResponse<Tool>> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      appendIfPresent(qs, k, v);
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<PaginatedResponse<Tool>>(`/tools/admin/all${suffix}`);
  },
};

// --------------------------------------------------------------------------
// Helper: build absolute URL for a tool photo
// --------------------------------------------------------------------------

/**
 * Append non-empty query parameters to a URLSearchParams instance.
 *
 * Values that are ``undefined`` / ``null`` / ``""`` are skipped. Used by
 * every list endpoint to build ``?key=value`` query strings.
 */
function appendIfPresent(
  qs: URLSearchParams,
  key: string,
  value: unknown,
): void {
  if (value === undefined || value === null || value === '') return;
  qs.set(key, String(value));
}

/**
 * Convert a stored photo URL like ``/uploads/abc.jpg`` into an absolute
 * URL the browser can load. The backend stores the path with the
 * ``/uploads/`` prefix already; we just prepend the origin (which is
 * the FastAPI host, NOT the API prefix).
 */
export function absolutePhotoUrl(photoUrl: string): string {
  if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
    return photoUrl;
  }
  const apiOrigin = API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');
  return `${apiOrigin}${photoUrl}`;
}
