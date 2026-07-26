// Admin API — /admin/* endpoints.
import { apiRequest } from './client';
import type { PaginatedResponse, ReservationResponse, UserProfile } from '../types/api';

export interface AuditLogEntry {
  id: string;
  action_type: string;
  actor_id: string;
  target_type: string;
  target_id: string;
  reason: string;
  created_at: string;
}

export interface ModerationProfile {
  user_id: string;
  email: string;
  full_name: string;
  status: string;
  violation_count: number;
  damage_reported: number;
  violation_history: Array<{
    report_id: string;
    tool_id: string;
    tool_name: string;
    reason: string;
    resolved_at: string | null;
    resolution_note: string | null;
  }>;
}

export interface ModerationReport {
  summary: Record<string, number>;
  records: AuditLogEntry[];
  report_type: string;
  date_from: string | null;
  date_to: string | null;
}

export interface ExportResponse {
  csv: string;
  filename: string;
  content_type: string;
}

export const adminApi = {
  listUsers: (params?: {
    status?: string;
    search?: string;
    page?: number;
    page_size?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.page_size) searchParams.set('page_size', String(params.page_size));
    const qs = searchParams.toString();
    return apiRequest<PaginatedResponse<UserProfile>>(
      'GET',
      qs ? `/admin/users?${qs}` : '/admin/users',
    );
  },

  getUser: (userId: string) =>
    apiRequest<UserProfile>('GET', `/admin/users/${userId}`),

  suspendUser: (userId: string, reason: string) =>
    apiRequest<{ message: string }>('POST', `/admin/users/${userId}/deactivate`, { reason }),

  unsuspendUser: (userId: string, reason: string) =>
    apiRequest<{ message: string }>('POST', `/admin/users/${userId}/reactivate`, { reason }),

  deleteUser: (userId: string, reason: string) =>
    apiRequest<{ message: string }>('DELETE', `/admin/users/${userId}`, { reason }),

  getAuditLog: (params?: {
    action_type?: string;
    target_type?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    page_size?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.action_type) searchParams.set('action_type', params.action_type);
    if (params?.target_type) searchParams.set('target_type', params.target_type);
    if (params?.date_from) searchParams.set('date_from', params.date_from);
    if (params?.date_to) searchParams.set('date_to', params.date_to);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.page_size) searchParams.set('page_size', String(params.page_size));
    const qs = searchParams.toString();
    return apiRequest<PaginatedResponse<AuditLogEntry>>(
      'GET',
      qs ? `/admin/audit-log?${qs}` : '/admin/audit-log',
    );
  },

  // US29 — moderation profile for a specific member
  getModerationProfile: (userId: string) =>
    apiRequest<ModerationProfile>('GET', `/admin/users/${userId}/moderation`),

  // US34 — admin view of all reservations
  listAllReservations: (params?: {
    state?: string;
    member_id?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    page_size?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.state) searchParams.set('state', params.state);
    if (params?.member_id) searchParams.set('member_id', params.member_id);
    if (params?.date_from) searchParams.set('date_from', params.date_from);
    if (params?.date_to) searchParams.set('date_to', params.date_to);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.page_size) searchParams.set('page_size', String(params.page_size));
    const qs = searchParams.toString();
    return apiRequest<PaginatedResponse<ReservationResponse>>(
      'GET',
      qs ? `/admin/reservations?${qs}` : '/admin/reservations',
    );
  },

  // US33 — moderation report
  getModerationReport: (params?: {
    date_from?: string;
    date_to?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.date_from) searchParams.set('date_from', params.date_from);
    if (params?.date_to) searchParams.set('date_to', params.date_to);
    const qs = searchParams.toString();
    return apiRequest<ModerationReport>(
      'GET',
      qs ? `/admin/reports/moderation?${qs}` : '/admin/reports/moderation',
    );
  },

  // US33 — export moderation report as CSV
  exportModerationReportCsv: (params?: {
    date_from?: string;
    date_to?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.date_from) searchParams.set('date_from', params.date_from);
    if (params?.date_to) searchParams.set('date_to', params.date_to);
    const qs = searchParams.toString();
    return apiRequest<{ csv: string; filename: string; content_type: string }>(
      'GET',
      qs ? `/admin/reports/moderation/export?${qs}` : '/admin/reports/moderation/export',
    );
  },
};
