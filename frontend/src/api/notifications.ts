// Notifications API — /notifications/* endpoints.
import { apiRequest } from './client';
import type { NotificationListResponse, NotificationResponse } from '../types/api';

export const notificationsApi = {
  list: (params?: {
    unread_only?: boolean;
    page?: number;
    page_size?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.unread_only) searchParams.set('unread_only', 'true');
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
    apiRequest<{ message: string }>(
      'POST',
      '/notifications/read-all',
    ),
};
