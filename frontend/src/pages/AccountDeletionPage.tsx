import { useState } from 'react';

import type { FormEvent } from 'react';

import { Link, Navigate, useNavigate } from 'react-router-dom';

// Required confirmation text before account deletion is allowed.
const requiredConfirmationText = 'DELETE';

// Mock active reservations shown when account deletion is blocked.
const mockActiveReservations = [
  {
    id: 'reservation-101',
    toolName: 'Cordless Drill',
    status: 'APPROVED',
    dateRange: '2026-07-08 to 2026-07-10',
  },
  {
    id: 'reservation-102',
    toolName: 'Extension Ladder',
    status: 'PICKED_UP',
    dateRange: '2026-07-06 to 2026-07-09',
  },
];

/**
 * AccountDeletionPage
 *
 * Frontend issues covered:
 * - #105 Create Account Deletion UI.
 * - #107 Display active reservation block message.
 *
 * Current R1 behavior:
 * - Frontend mock/demo page only.
 * - Uses localStorage for mock authentication.
 * - Shows a blocking message when the mock user has active reservations.
 * - Allows demo deletion only after active reservations are turned off.
 *
 * Future backend behavior:
 * - Backend should verify authentication.
 * - Backend should check active reservations before deleting/deactivating account.
 * - Backend should perform account deletion or soft deletion.
 */
function AccountDeletionPage() {
  // React Router navigation after mock account deletion.
  const navigate = useNavigate();

  // localStorage key used by LoginPage, RegisterPage, and AppLayout for mock auth.
  const mockAuthKey = 'mockAuthStatus';

  // localStorage key used by profile setup/edit profile mock pages.
  const mockProfileKey = 'mockUserProfile';

  // Check whether user is logged in using mock frontend auth.
  const isLoggedIn = localStorage.getItem(mockAuthKey) === 'logged-in';

  // Demo control for issue #107.
  // Default true so the active reservation block message is visible for reviewers.
  const [hasActiveReservations, setHasActiveReservations] = useState(true);

  // Store confirmation text typed by the user.
  const [confirmationText, setConfirmationText] = useState('');

  // Store whether the user checked the final warning checkbox.
  const [understandsDeletion, setUnderstandsDeletion] = useState(false);

  // Store optional reason text.
  const [deleteReason, setDeleteReason] = useState('');

  // Store validation or block message.
  const [errorMessage, setErrorMessage] = useState('');

  // Store success message after mock deletion.
  const [successMessage, setSuccessMessage] = useState('');

  /**
   * Redirect unauthenticated users to Login.
   *
   * Important:
   * - This is frontend-only route protection.
   * - Backend authorization is still required later.
   */
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  /**
   * Handle mock account deletion submit.
   *
   * Validation:
   * - Blocks deletion if active reservations exist.
   * - Requires user to type DELETE.
   * - Requires final confirmation checkbox.
   */
  function handleDeleteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Clear old messages before validating the new submit.
    setErrorMessage('');
    setSuccessMessage('');

    // Issue #107:
    // Block account deletion when active reservations exist.
    if (hasActiveReservations) {
      setErrorMessage(
        'Account deletion is blocked because you have active reservations. Please cancel, complete, or return all active reservations before deleting your account.',
      );
      return;
    }

    // Require exact confirmation text.
    if (confirmationText.trim() !== requiredConfirmationText) {
      setErrorMessage('Please type DELETE to confirm account deletion.');
      return;
    }

    // Require the user to acknowledge that deletion is permanent.
    if (!understandsDeletion) {
      setErrorMessage('Please confirm that you understand this action cannot be undone.');
      return;
    }

    // Show success message before redirecting.
    setSuccessMessage(
      'Your account deletion request was submitted. You will be redirected to Login.',
    );

    // Keep delete reason available for future backend integration.
    // In the R1 mock page, this value is not sent anywhere.
    console.info('Mock account deletion reason:', deleteReason.trim() || 'No reason given');

    // Mock account deletion behavior:
    // - Clear mock auth.
    // - Clear mock profile.
    // - Notify AppLayout to update the nav.
    //
    // This is deferred until the redirect fires (rather than done immediately)
    // because AccountDeletionPage re-checks localStorage on every render and
    // redirects unauthenticated users to /login. Clearing auth immediately
    // would trigger that redirect on this same render pass, before the user
    // ever sees the success message above.
    window.setTimeout(() => {
      localStorage.removeItem(mockAuthKey);
      localStorage.removeItem(mockProfileKey);
      window.dispatchEvent(new Event('mock-auth-change'));
      navigate('/login');
    }, 900);
  }

  return (
    <section className="page-section">
      {/* Page header explains this is a dangerous account action. */}
      <div className="page-header">
        <div>
          <p className="eyebrow">Account Settings</p>
          <h1>Delete Account</h1>
          <p className="page-description">
            Review active reservation restrictions before deleting your account.
          </p>
        </div>

        {/* Header action returns user to Profile page. */}
        <Link className="secondary-link header-action-link" to="/profile/edit">
          Back to Profile
        </Link>
      </div>

      {/* Main account deletion layout. */}
      <div className="account-deletion-layout">
        {/* Left side: account deletion form and active reservation block. */}
        <form className="account-deletion-card" onSubmit={handleDeleteSubmit} noValidate>
          <h2>Delete Your Account</h2>

          {/* Warning panel for destructive action. */}
          <div className="deletion-warning-panel">
            <h3>Warning</h3>
            <p>
              Account deletion is a serious action. Your profile, account access, and
              account-related information may no longer be available after deletion.
            </p>
          </div>

          {/* Issue #107: active reservation block message. */}
          {hasActiveReservations && (
            <div className="active-reservation-block">
              <h3>Account deletion is currently blocked</h3>
              <p>
                You cannot delete your account while you have active reservations.
                Please cancel, complete, or return all active reservations first.
              </p>

              <ul className="active-reservation-list">
                {mockActiveReservations.map((reservation) => (
                  <li key={reservation.id}>
                    <strong>{reservation.toolName}</strong>
                    <span>{reservation.status}</span>
                    <span>{reservation.dateRange}</span>
                  </li>
                ))}
              </ul>

              <Link className="secondary-link narrow-link" to="/reservations">
                View Reservations
              </Link>
            </div>
          )}

          {/* Optional reason for account deletion. */}
          <label htmlFor="delete-reason">
            Reason for Deleting Account Optional
            <textarea
              id="delete-reason"
              value={deleteReason}
              onChange={(event) => setDeleteReason(event.target.value)}
              rows={4}
              placeholder="Optional: tell us why you are deleting your account."
            />
          </label>

          {/* Confirmation text input. */}
          <label htmlFor="delete-confirmation">
            Type DELETE to Confirm
            <input
              id="delete-confirmation"
              type="text"
              value={confirmationText}
              onChange={(event) => setConfirmationText(event.target.value)}
              placeholder="DELETE"
              disabled={hasActiveReservations}
            />
          </label>

          {/* Final confirmation checkbox. */}
          <label className="checkbox-row" htmlFor="understand-deletion">
            <input
              id="understand-deletion"
              type="checkbox"
              checked={understandsDeletion}
              onChange={(event) => setUnderstandsDeletion(event.target.checked)}
              disabled={hasActiveReservations}
            />
            I understand this action cannot be undone.
          </label>

          {/* Delete button is disabled while active reservations exist. */}
          <button
            className="danger-action-button"
            type="submit"
            disabled={hasActiveReservations}
          >
            Delete Account
          </button>

          {/* Inline validation and success messages. */}
          {errorMessage && <p className="form-error">{errorMessage}</p>}
          {successMessage && <p className="form-success">{successMessage}</p>}
        </form>

        {/* Right side: demo controls and checklist. */}
        <aside className="account-deletion-card">
          <h2>Deletion Checklist</h2>

          <ul className="deletion-checklist">
            <li>Return or cancel all active reservations.</li>
            <li>Confirm you understand deletion cannot be undone.</li>
            <li>Type DELETE before submitting the request.</li>
          </ul>

          {/* Demo control lets reviewers test both blocked and allowed states. */}
          <div className="demo-control-panel">
            <h3>Demo Control</h3>
            <p>
              Use this checkbox to simulate whether the mock account has active
              reservations.
            </p>

            <label className="checkbox-row" htmlFor="mock-active-reservations">
              <input
                id="mock-active-reservations"
                type="checkbox"
                checked={hasActiveReservations}
                onChange={(event) => {
                  setHasActiveReservations(event.target.checked);
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
              />
              Account has active reservations
            </label>
          </div>

          <p className="auth-helper-text">
            Demo note: real account deletion must be enforced by the backend. This page
            only demonstrates the frontend UI and validation.
          </p>
        </aside>
      </div>
    </section>
  );
}

export default AccountDeletionPage;
