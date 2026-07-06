// Tools API — /tools/* endpoints.
import { apiRequest } from './client';
import type {
  PaginatedResponse,
  ToolDeactivate,
  ToolResponse,
  ToolUpdate,
} from '../types/api';

export const toolsApi = {
  list: (params?: {
    category?: string;
    search?: string;
    available_start?: string;
    available_end?: string;
    page?: number;
    page_size?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set('category', params.category);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.available_start) searchParams.set('available_start', params.available_start);
    if (params?.available_end) searchParams.set('available_end', params.available_end);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.page_size) searchParams.set('page_size', String(params.page_size));
    const qs = searchParams.toString();
    return apiRequest<PaginatedResponse<ToolResponse>>(
      'GET',
      qs ? `/tools?${qs}` : '/tools',
    );
  },

  listMy: (params?: { page?: number; page_size?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.page_size) searchParams.set('page_size', String(params.page_size));
    const qs = searchParams.toString();
    return apiRequest<PaginatedResponse<ToolResponse>>(
      'GET',
      qs ? `/tools/me?${qs}` : '/tools/me',
    );
  },

  get: (toolId: string) =>
    apiRequest<ToolResponse>('GET', `/tools/${toolId}`),

  create: (formData: FormData) =>
    apiRequest<ToolResponse>('POST', '/tools', formData, { isFormData: true }),

  update: (toolId: string, data: ToolUpdate) =>
    apiRequest<ToolResponse>('PATCH', `/tools/${toolId}`, data),

  delete: (toolId: string) =>
    apiRequest<void>('DELETE', `/tools/${toolId}`),

  addPhotos: (toolId: string, formData: FormData) =>
    apiRequest<ToolResponse>('POST', `/tools/${toolId}/photos`, formData, { isFormData: true }),

  removePhoto: (toolId: string, photoId: string) =>
    apiRequest<void>('DELETE', `/tools/${toolId}/photos/${photoId}`),

  deactivate: (toolId: string, data: ToolDeactivate) =>
    apiRequest<ToolResponse>('POST', `/tools/${toolId}/deactivate`, data),

  reactivate: (toolId: string) =>
    apiRequest<ToolResponse>('POST', `/tools/${toolId}/reactivate`),

  // Admin-only
  adminListAll: (params?: {
    status?: string;
    category?: string;
    search?: string;
    page?: number;
    page_size?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.category) searchParams.set('category', params.category);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.page_size) searchParams.set('page_size', String(params.page_size));
    const qs = searchParams.toString();
    return apiRequest<PaginatedResponse<ToolResponse>>(
      'GET',
      qs ? `/tools/admin/all?${qs}` : '/tools/admin/all',
    );
  },
};
