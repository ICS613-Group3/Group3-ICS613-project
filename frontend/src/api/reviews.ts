// Reviews API — /reviews/* and /reservations/:id/review endpoints.
import { apiRequest } from './client';
import type { ReviewCreate, ReviewResponse, ReviewUpdate } from '../types/api';

export const reviewsApi = {
  create: (reservationId: string, data: ReviewCreate) =>
    apiRequest<ReviewResponse>(
      'POST',
      `/reservations/${reservationId}/review`,
      data,
    ),

  get: (reviewId: string) =>
    apiRequest<ReviewResponse>('GET', `/reviews/${reviewId}`),

  update: (reviewId: string, data: ReviewUpdate) =>
    apiRequest<ReviewResponse>('PUT', `/reviews/${reviewId}`, data),

  delete: (reviewId: string) =>
    apiRequest<void>('DELETE', `/reviews/${reviewId}`),

  listMyReviews: (params?: { role?: 'given' | 'received'; page?: number; page_size?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.role) searchParams.set('role', params.role);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.page_size) searchParams.set('page_size', String(params.page_size));
    const qs = searchParams.toString();
    return apiRequest<{ items: ReviewResponse[]; total: number; page: number; page_size: number; pages: number }>(
      'GET',
      qs ? `/reviews/users/me/reviews?${qs}` : '/reviews/users/me/reviews',
    );
  },
};
