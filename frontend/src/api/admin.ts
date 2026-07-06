// Admin API — /admin/* endpoints.
import { apiRequest } from './client';
import type { UserProfile } from '../types/api';

export interface AuditLogEntry {
  id: string;
  action: string;
  actor_id: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown> | null;
  created_at: string;
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
    return apiRequest<{ items: UserProfile[]; total: number; page: number; page_size: number; pages: number }>(
      'GET',
      qs ? `/admin/users?${qs}` : '/admin/users',
    );
  },

  getUser: (userId: string) =>
    apiRequest<UserProfile>('GET', `/admin/users/${userId}`),

  suspendUser: (userId: string) =>
    apiRequest<UserProfile>('POST', `/admin/users/${userId}/suspend`),

  unsuspendUser: (userId: string) =>
    apiRequest<UserProfile>('POST', `/admin/users/${userId}/unsuspend`),

  getAuditLog: (params?: {
    action?: string;
    actor_id?: string;
    page?: number;
    page_size?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.action) searchParams.set('action', params.action);
    if (params?.actor_id) searchParams.set('actor_id', params.actor_id);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.page_size) searchParams.set('page_size', String(params.page_size));
    const qs = searchParams.toString();
    return apiRequest<{ items: AuditLogEntry[]; total: number; page: number; page_size: number; pages: number }>(
      'GET',
      qs ? `/admin/audit-log?${qs}` : '/admin/audit-log',
    );
  },
};
