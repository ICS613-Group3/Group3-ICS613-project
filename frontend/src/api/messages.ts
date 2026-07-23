// Messages API — reservation messaging endpoints (US22).
import { apiRequest } from './client';
import type { PaginatedResponse } from '../types/api';

export interface MessageCreate {
  body: string;
}

export interface MessageResponse {
  id: string;
  reservation_id: string;
  sender_id: string;
  sender_name: string | null;
  body: string;
  created_at: string;
}

export const messagesApi = {
  list: (
    reservationId: string,
    params?: { page?: number; page_size?: number },
  ) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.page_size) searchParams.set('page_size', String(params.page_size));
    const qs = searchParams.toString();
    return apiRequest<PaginatedResponse<MessageResponse>>(
      'GET',
      qs
        ? `/reservations/${reservationId}/messages?${qs}`
        : `/reservations/${reservationId}/messages`,
    );
  },

  send: (reservationId: string, data: MessageCreate) =>
    apiRequest<MessageResponse>(
      'POST',
      `/reservations/${reservationId}/messages`,
      data,
    ),
};
