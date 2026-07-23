// TypeScript types matching backend Pydantic schemas.
// All field names use snake_case to match backend JSON responses.

// ── Enums ──────────────────────────────────────────────────────────────

export type ToolCategory =
  | 'HAND_TOOLS'
  | 'POWER_TOOLS'
  | 'GARDEN_TOOLS'
  | 'CLEANING_TOOLS'
  | 'OUTDOOR_GEAR';

export type ToolCondition = 'NEW' | 'LIKE_NEW' | 'GOOD' | 'FAIR' | 'POOR';

export type ReservationState =
  | 'REQUESTED'
  | 'APPROVED'
  | 'DENIED'
  | 'CANCELLED'
  | 'PICKED_UP'
  | 'RETURNED';

export type UserStatus = 'ACTIVE' | 'EMAIL_PENDING' | 'SUSPENDED' | 'DELETED';

export type NotificationType =
  | 'RESERVATION_REQUEST'
  | 'RESERVATION_APPROVED'
  | 'RESERVATION_DENIED'
  | 'RESERVATION_CANCELLED'
  | 'TOOL_PICKED_UP'
  | 'TOOL_RETURNED'
  | 'DAMAGE_REPORTED'
  | 'REVIEW_RECEIVED'
  | 'SYSTEM';

export type DeactivationActor = 'OWNER' | 'ADMIN';

// ── Common ─────────────────────────────────────────────────────────────

export interface MessageResponse {
  message: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

// ── Auth ───────────────────────────────────────────────────────────────

export interface TokenPairResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name?: string;
  invite_token: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface ResendRequest {
  email: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

export interface InviteCreate {
  email: string;
}

export interface InviteResponse {
  id: string;
  token: string;
  email: string;
  status: string;
  expires_at: string;
  created_at: string;
}

// ── User ───────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  bio: string | null;
  neighborhood: string | null;
  photo_url: string | null;
  status: UserStatus;
  trust_score: number;
  damage_reported: number;
  violation_count: number;
  created_at: string;
  is_admin: boolean;
}

export interface UserUpdate {
  full_name?: string | null;
  bio?: string | null;
  neighborhood?: string | null;
  photo_url?: string | null;
}

// ── Tool ───────────────────────────────────────────────────────────────

export interface OwnerSummary {
  id: string;
  full_name: string | null;
  photo_url: string | null;
}

export interface PhotoOut {
  id: string;
  url: string;
  display_order: number;
}

export interface ToolResponse {
  id: string;
  owner_id: string;
  owner: OwnerSummary;
  name: string;
  description: string | null;
  category: ToolCategory;
  condition: ToolCondition;
  is_active: boolean;
  deactivated_by: DeactivationActor | null;
  deactivated_at: string | null;
  deactivation_reason: string | null;
  avg_rating: number;
  rating_count: number;
  photos: PhotoOut[];
  created_at: string;
  updated_at: string;
}

/**
 * Review displayed on another member's public profile.
 *
 * Issue #52 requires the reservation date in addition to the normal
 * review rating, comment, reviewer name, and creation timestamp.
 */
export interface PublicMemberReview {
  id: string;
  reservation_id: string;
  reviewer_id: string;
  reviewer_name: string | null;
  rating: number;
  comment: string | null;
  reservation_date: string;
  created_at: string;
}

/**
 * Public-safe member profile response for Issue #52.
 *
 * This response intentionally excludes private information such as:
 * - Email address
 * - Password/authentication data
 * - Admin status
 * - Internal violation-management information
 */
export interface PublicMemberProfileResponse {
  id: string;
  full_name: string | null;
  bio: string | null;
  neighborhood: string | null;
  photo_url: string | null;
  status: UserStatus;
  member_since: string;
  average_rating: number;
  review_count: number;
  completed_loans_as_owner: number;
  damage_report_count: number;
  active_tools: ToolResponse[];
  reviews: PublicMemberReview[];
}
export interface ToolUpdate {
  name?: string;
  description?: string;
  category?: ToolCategory;
  condition?: ToolCondition;
}

export interface ToolDeactivate {
  reason: string;
}

// ── Reservation ────────────────────────────────────────────────────────

export interface ReservationCreate {
  tool_id: string;
  start_date: string;
  end_date: string;
}

export interface ReservationResponse {
  id: string;
  tool_id: string;
  borrower_id: string;
  state: ReservationState;
  start_date: string;
  end_date: string;
  cancelled_by_type: string | null;
  cancelled_reason: string | null;
  denied_reason: string | null;
  picked_up_at: string | null;
  returned_at: string | null;
  damage_reported: boolean;
  damage_description: string | null;
  damage_reported_at: string | null;
  force_resolved_by: string | null;
  force_resolved_at: string | null;
  force_resolution_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReservationDeny {
  reason?: string;
}

export interface ReservationCancel {
  reason: string;
}

export interface ReservationDamageReport {
  description: string;
}

export interface ReservationForceReturn {
  reason: string;
}

// ── Review ─────────────────────────────────────────────────────────────

export interface ReviewCreate {
  rating: number;
  comment?: string;
}

export interface ReviewUpdate {
  rating?: number;
  comment?: string;
}

export interface ReviewResponse {
  id: string;
  reservation_id: string;
  reviewer_id: string;
  reviewer_name?: string | null;
  reviewee_id: string;
  reviewee_name?: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

// ── Notification ───────────────────────────────────────────────────────

export interface NotificationResponse {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationListResponse {
  items: NotificationResponse[];
  total: number;
  unread_count: number;
  page: number;
  page_size: number;
  pages: number;
}
