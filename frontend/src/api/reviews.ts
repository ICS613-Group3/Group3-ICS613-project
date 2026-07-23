// Reviews API — review creation, history, update, and delete endpoints.
import { apiRequest } from './client';
import type {
  PaginatedResponse,
  ReviewCreate,
  ReviewResponse,
  ReviewUpdate,
} from '../types/api';

export const reviewsApi = {
  create: (reservationId: string, data: ReviewCreate) =>
    apiRequest<ReviewResponse>(
      'POST',
      `/reservations/${reservationId}/review`,
      data,
    ),

  listForReservation: (reservationId: string) =>
    apiRequest<ReviewResponse[]>(
      'GET',
      `/reservations/${reservationId}/review`,
    ),

  update: (reviewId: string, data: ReviewUpdate) =>
    apiRequest<ReviewResponse>(
      'PATCH',
      `/reviews/${reviewId}`,
      data,
    ),

  delete: (reviewId: string) =>
    apiRequest<void>(
      'DELETE',
      `/reviews/${reviewId}`,
    ),

  listMyReviews: (params?: {
    role?: 'given' | 'received';
    page?: number;
    page_size?: number;
  }) => {
    const searchParams = new URLSearchParams();

    if (params?.role) {
      searchParams.set('role', params.role);
    }

    if (params?.page) {
      searchParams.set('page', String(params.page));
    }

    if (params?.page_size) {
      searchParams.set('page_size', String(params.page_size));
    }

    const queryString = searchParams.toString();

    return apiRequest<PaginatedResponse<ReviewResponse>>(
      'GET',
      queryString
        ? `/users/me/reviews?${queryString}`
        : '/users/me/reviews',
    );
  },
};
