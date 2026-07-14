// Mock request handlers that return the same JSON shape as the real backend.
// Activated when VITE_USE_MOCKS=true.

import {
  getMockUserByToken,
  mockNotifications,
  mockReservations,
  mockTools,
  mockUsers,
} from './fixtures';
import type {
  LoginRequest,
  RegisterRequest,
  ReservationState,
  TokenPairResponse,
} from '../types/api';

type MockResult = [unknown, number];

function parseAuthHeader(headers: Record<string, string>): string | null {
  const auth = headers['Authorization'] || headers['authorization'] || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function getMockCurrentUser(headers: Record<string, string>) {
  const token = parseAuthHeader(headers);
  if (!token) return null;
  return getMockUserByToken(token) || null;
}

function requireAuth(headers: Record<string, string>): MockResult | null {
  const user = getMockCurrentUser(headers);
  if (!user) return [{ detail: 'Not authenticated', error_code: 'AuthenticationError' }, 401];
  return null;
}

function paginate<T>(items: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  const paged = items.slice(start, start + pageSize);
  return {
    items: paged,
    total: items.length,
    page,
    page_size: pageSize,
    pages: Math.max(1, Math.ceil(items.length / pageSize)),
  };
}

export async function matchMock(
  method: string,
  path: string,
  body: unknown,
  headers: Record<string, string>,
): Promise<MockResult> {
  const user = getMockCurrentUser(headers);

  // ── Auth ──────────────────────────────────────────────────────────

  if (method === 'POST' && path === '/auth/login') {
    const { email, password } = body as LoginRequest;
    if (!email || !password) {
      return [{ detail: 'Email and password required', error_code: 'ValidationError' }, 422];
    }
    // Accept any non-empty credentials in mock mode.
    const mockUser = mockUsers.find((u) => u.email === email) || mockUsers[0];
    const token = mockUser.is_admin ? 'mock-token-admin' : `mock-token-${mockUser.id}`;
    const tokens: TokenPairResponse = {
      access_token: token,
      refresh_token: 'mock-refresh-token',
      token_type: 'bearer',
    };
    return [tokens, 200];
  }

  if (method === 'POST' && path === '/auth/register') {
    const { invite_token } = body as RegisterRequest;
    if (!invite_token || invite_token.length < 4) {
      return [{ detail: 'Invalid invite token', error_code: 'ValidationError' }, 422];
    }
    return [{ message: 'Registration successful. Please check your email to verify your account.' }, 201];
  }

  if (method === 'POST' && path === '/auth/logout') {
    return [{ message: 'Logged out successfully' }, 200];
  }

  if (method === 'POST' && path === '/auth/refresh') {
    const tokens: TokenPairResponse = {
      access_token: 'mock-token-user1',
      refresh_token: 'mock-refresh-token',
      token_type: 'bearer',
    };
    return [tokens, 200];
  }

  if (method === 'GET' && path === '/auth/me') {
    const authErr = requireAuth(headers);
    if (authErr) return authErr;
    return [user!, 200];
  }

  if (method === 'PUT' && path === '/auth/me') {
    const authErr = requireAuth(headers);
    if (authErr) return authErr;
    return [{ ...user!, ...(body as object) }, 200];
  }

  if (method === 'DELETE' && path === '/auth/me') {
    const authErr = requireAuth(headers);
    if (authErr) return authErr;
    return [undefined, 204];
  }

  if (method === 'POST' && path === '/auth/forgot-password') {
    return [{ message: 'If an account with that email exists, a reset email has been sent.' }, 200];
  }

  if (method === 'POST' && path === '/auth/reset-password') {
    const tokens: TokenPairResponse = {
      access_token: 'mock-token-user1',
      refresh_token: 'mock-refresh-token',
      token_type: 'bearer',
    };
    return [tokens, 200];
  }

  if (method === 'POST' && path === '/auth/invites') {
    const authErr = requireAuth(headers);
    if (authErr) return authErr;
    if (!user?.is_admin) return [{ detail: 'Admin only', error_code: 'PermissionDeniedError' }, 403];
    return [{
      id: 'inv-new',
      token: 'MOCK-NEW-TOKEN',
      email: (body as { email: string }).email,
      status: 'sent',
      expires_at: '2026-08-01T00:00:00Z',
      created_at: new Date().toISOString(),
    }, 201];
  }

  if (method === 'GET' && path === '/auth/invites') {
    const authErr = requireAuth(headers);
    if (authErr) return authErr;
    return [[], 200];
  }

  // ── Tools ─────────────────────────────────────────────────────────

  if (method === 'GET' && path === '/tools') {
    const authErr = requireAuth(headers);
    if (authErr) return authErr;
    return [paginate(mockTools, 1, 20), 200];
  }

  if (method === 'GET' && path === '/tools/me') {
    const authErr = requireAuth(headers);
    if (authErr) return authErr;
    const myTools = mockTools.filter((t) => t.owner_id === user?.id);
    return [paginate(myTools, 1, 20), 200];
  }

  const toolMatch = path.match(/^\/tools\/([^/]+)$/);
  if (method === 'GET' && toolMatch) {
    const authErr = requireAuth(headers);
    if (authErr) return authErr;
    const tool = mockTools.find((t) => t.id === toolMatch[1]);
    if (!tool) return [{ detail: 'Tool not found', error_code: 'NotFoundError' }, 404];
    return [tool, 200];
  }

  if (method === 'POST' && path === '/tools') {
    const authErr = requireAuth(headers);
    if (authErr) return authErr;
    const formData = body as FormData;
    return [{
      id: 'tool-new',
      owner_id: user!.id,
      owner: { id: user!.id, full_name: user!.full_name, photo_url: user!.photo_url },
      name: String(formData.get('name') || 'New Tool'),
      description: String(formData.get('description') || ''),
      category: String(formData.get('category') || 'HAND_TOOLS'),
      condition: String(formData.get('condition') || 'GOOD'),
      is_active: true,
      deactivated_by: null,
      deactivated_at: null,
      deactivation_reason: null,
      avg_rating: 0,
      rating_count: 0,
      photos: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, 201];
  }

  // ── Reservations ──────────────────────────────────────────────────

  if (method === 'GET' && path === '/reservations') {
    const authErr = requireAuth(headers);
    if (authErr) return authErr;
    const userRes = mockReservations.filter(
      (r) => r.borrower_id === user!.id || mockTools.find((t) => t.id === r.tool_id)?.owner_id === user!.id,
    );
    return [paginate(userRes, 1, 20), 200];
  }

  const resMatch = path.match(/^\/reservations\/([^/]+)$/);
  if (method === 'GET' && resMatch) {
    const authErr = requireAuth(headers);
    if (authErr) return authErr;
    const res = mockReservations.find((r) => r.id === resMatch[1]);
    if (!res) return [{ detail: 'Reservation not found', error_code: 'NotFoundError' }, 404];
    return [res, 200];
  }

  if (method === 'POST' && path === '/reservations') {
    const authErr = requireAuth(headers);
    if (authErr) return authErr;
    const data = body as { tool_id: string; start_date: string; end_date: string };
    return [{
      id: `res-${mockReservations.length + 1}`,
      tool_id: data.tool_id,
      borrower_id: user!.id,
      state: 'REQUESTED' as ReservationState,
      start_date: data.start_date,
      end_date: data.end_date,
      cancelled_by_type: null,
      cancelled_reason: null,
      denied_reason: null,
      picked_up_at: null,
      returned_at: null,
      damage_reported: false,
      damage_description: null,
      damage_reported_at: null,
      force_resolved_by: null,
      force_resolved_at: null,
      force_resolution_reason: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, 201];
  }

  // State transitions
  const transitionPatterns = [
    'approve', 'deny', 'cancel', 'mark-picked-up', 'mark-returned',
  ];
  for (const action of transitionPatterns) {
    const m = path.match(new RegExp(`^/reservations/([^/]+)/${action}$`));
    if (method === 'POST' && m) {
      const authErr = requireAuth(headers);
      if (authErr) return authErr;
      const res = mockReservations.find((r) => r.id === m[1]);
      if (!res) return [{ detail: 'Reservation not found', error_code: 'NotFoundError' }, 404];
      const stateMap: Record<string, ReservationState> = {
        approve: 'APPROVED',
        deny: 'DENIED',
        cancel: 'CANCELLED',
        'mark-picked-up': 'PICKED_UP',
        'mark-returned': 'RETURNED',
      };
      return [{ ...res, state: stateMap[action] }, 200];
    }
  }

  // ── Notifications ─────────────────────────────────────────────────

  if (method === 'GET' && path === '/notifications') {
    const authErr = requireAuth(headers);
    if (authErr) return authErr;
    const unreadCount = mockNotifications.filter((n) => !n.read_at).length;
    return [{ items: mockNotifications, total: mockNotifications.length, unread_count: unreadCount, page: 1, page_size: 20, pages: 1 }, 200];
  }

  const notifMarkRead = path.match(/^\/notifications\/([^/]+)\/read$/);
  if (method === 'POST' && notifMarkRead) {
    const authErr = requireAuth(headers);
    if (authErr) return authErr;
    const n = mockNotifications.find((n2) => n2.id === notifMarkRead[1]);
    if (!n) return [{ detail: 'Not found', error_code: 'NotFoundError' }, 404];
    return [{ ...n, read_at: new Date().toISOString() }, 200];
  }

  // ── Fallback ─────────────────────────────────────────────────────

  return [{ detail: `Mock: no handler for ${method} ${path}`, error_code: 'NotImplemented' }, 501];
}
