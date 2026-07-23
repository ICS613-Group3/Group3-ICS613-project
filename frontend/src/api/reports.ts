// Reports API — /reports and /tools/{id}/report endpoints (US26/US27).
import { apiRequest } from './client';
import type { PaginatedResponse } from '../types/api';

export type ReportReason =
  | 'INAPPROPRIATE_CONTENT'
  | 'PROHIBITED_ITEM'
  | 'MISLEADING_LISTING'
  | 'SCAM_OR_FRAUD'
  | 'DUPLICATE_LISTING'
  | 'OTHER';

export type ReportStatus = 'PENDING' | 'VALID' | 'INVALID';

export interface ReportCreate {
  reason: ReportReason;
  comment?: string;
}

export interface ReportResolve {
  valid: boolean;
  note?: string;
}

export interface ReportResponse {
  id: string;
  tool_id: string;
  tool_name: string | null;
  reporter_id: string;
  reporter_name: string | null;
  reason: string;
  comment: string | null;
  status: ReportStatus;
  resolved_by: string | null;
  resolver_name: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
}

export const reportsApi = {
  submit: (toolId: string, data: ReportCreate) =>
    apiRequest<ReportResponse>('POST', `/tools/${toolId}/report`, data),

  list: (params?: {
    status?: string;
    page?: number;
    page_size?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.page_size) searchParams.set('page_size', String(params.page_size));
    const qs = searchParams.toString();
    return apiRequest<PaginatedResponse<ReportResponse>>(
      'GET',
      qs ? `/reports?${qs}` : '/reports',
    );
  },

  resolve: (reportId: string, data: ReportResolve) =>
    apiRequest<ReportResponse>('POST', `/reports/${reportId}/resolve`, data),

  listMy: (params?: {
    status?: string;
    page?: number;
    page_size?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.page_size) searchParams.set('page_size', String(params.page_size));
    const qs = searchParams.toString();
    return apiRequest<PaginatedResponse<ReportResponse>>(
      'GET',
      qs ? `/reports/me?${qs}` : '/reports/me',
    );
  },
};
