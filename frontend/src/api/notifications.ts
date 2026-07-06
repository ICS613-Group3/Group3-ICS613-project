// Notifications API — /notifications/* endpoints.
import { apiRequest } from './client';
import type { NotificationListResponse, NotificationResponse } from '../types/api';

export const notificationsApi = {
  list: (params?: {
    include_read?: boolean;
    page?: number;
    page_size?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.include_read) searchParams.set('include_read', 'true');
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.page_size) searchParams.set('page_size', String(params.page_size));
    const qs = searchParams.toString();
    return apiRequest<NotificationListResponse>(
      'GET',
      qs ? `/notifications?${qs}` : '/notifications',
    );
  },

  markRead: (notificationId: string) =>
    apiRequest<NotificationResponse>(
      'POST',
      `/notifications/${notificationId}/read`,
    ),

  markAllRead: () =>
    apiRequest<NotificationResponse[]>(
      'POST',
      '/notifications/read-all',
    ),
};
