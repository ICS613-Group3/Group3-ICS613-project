// Public member-profile API for Issue #52.
import { apiRequest } from './client';
import type { PublicMemberProfileResponse } from '../types/api';

export const membersApi = {
  /**
   * Retrieve another member's public profile.
   *
   * Expected backend endpoint:
   * GET /api/v1/users/{memberId}
   *
   * The response must exclude private information and aggregate:
   * - Public profile details
   * - Average rating
   * - Completed loans as owner
   * - Damage-report trust signals
   * - Active tool listings
   * - Reviews written about the member
   */
  getPublicProfile: (memberId: string) =>
    apiRequest<PublicMemberProfileResponse>(
      'GET',
      `/users/${encodeURIComponent(memberId)}`,
    ),
};
