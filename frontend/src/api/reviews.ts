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
};
