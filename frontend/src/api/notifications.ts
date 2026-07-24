// Notifications API — backend notification list and mark-read endpoints.
import { apiRequest } from './client';
import type {
  NotificationListResponse,
  NotificationResponse,
} from '../types/api';

export const notificationsApi = {
  list: (params?: {
    include_read?: boolean;
    page?: number;
    page_size?: number;
  }) => {
    const searchParams = new URLSearchParams();

    if (params?.include_read) {
      searchParams.set('include_read', 'true');
    }

    if (params?.page) {
      searchParams.set('page', String(params.page));
    }

    if (params?.page_size) {
      searchParams.set('page_size', String(params.page_size));
    }

    const queryString = searchParams.toString();

    return apiRequest<NotificationListResponse>(
      'GET',
      queryString
        ? `/notifications?${queryString}`
        : '/notifications',
    );
  },

  markRead: (notificationId: string) =>
    apiRequest<NotificationResponse>(
      'POST',
      `/notifications/${notificationId}/read`,
    ),
};
