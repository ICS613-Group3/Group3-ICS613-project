// Reservations API — /reservations/* endpoints.
import { apiRequest } from './client';
import type {
  PaginatedResponse,
  ReservationCancel,
  ReservationCreate,
  ReservationDamageReport,
  ReservationDeny,
  ReservationForceReturn,
  ReservationResponse,
} from '../types/api';

export const reservationsApi = {
  list: (params?: {
    role?: string;
    state?: string;
    page?: number;
    page_size?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.role) searchParams.set('role', params.role);
    if (params?.state) searchParams.set('state', params.state);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.page_size) searchParams.set('page_size', String(params.page_size));
    const qs = searchParams.toString();
    return apiRequest<PaginatedResponse<ReservationResponse>>(
      'GET',
      qs ? `/reservations?${qs}` : '/reservations',
    );
  },

  get: (reservationId: string) =>
    apiRequest<ReservationResponse>('GET', `/reservations/${reservationId}`),

  create: (data: ReservationCreate) =>
    apiRequest<ReservationResponse>('POST', '/reservations', data),

  approve: (reservationId: string) =>
    apiRequest<ReservationResponse>(
      'POST',
      `/reservations/${reservationId}/approve`,
    ),

  deny: (reservationId: string, data: ReservationDeny) =>
    apiRequest<ReservationResponse>(
      'POST',
      `/reservations/${reservationId}/deny`,
      data,
    ),

  cancel: (reservationId: string, data: ReservationCancel) =>
    apiRequest<ReservationResponse>(
      'POST',
      `/reservations/${reservationId}/cancel`,
      data,
    ),

  markPickedUp: (reservationId: string) =>
    apiRequest<ReservationResponse>(
      'POST',
      `/reservations/${reservationId}/mark-picked-up`,
    ),

  markReturned: (reservationId: string) =>
    apiRequest<ReservationResponse>(
      'POST',
      `/reservations/${reservationId}/mark-returned`,
    ),

  reportDamage: (reservationId: string, data: ReservationDamageReport) =>
    apiRequest<ReservationResponse>(
      'POST',
      `/reservations/${reservationId}/report-damage`,
      data,
    ),

  // Admin-only
  forceReturn: (reservationId: string, data: ReservationForceReturn) =>
    apiRequest<ReservationResponse>(
      'POST',
      `/reservations/${reservationId}/force-return`,
      data,
    ),
};
