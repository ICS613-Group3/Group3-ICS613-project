import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, authApi } from '../api/client';
import { useAuth } from '../context/authContextValue';

/**
 * ProfilePage
 *
 * Combines US5 (set up profile), US6 (edit profile), and US7 (delete
 * account) on a single page since they all operate on the same
 * ``/auth/me`` resource. Editing hits ``PUT /auth/me``; deleting hits
 * ``DELETE /auth/me`` (soft-delete; the account is anonymized and any
 * future ``/auth/login`` returns 401).
 */
function ProfilePage() {
  const navigate = useNavigate();
  const { user, refreshProfile, logout } = useAuth();

  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [neighborhood, setNeighborhood] = useState(user?.neighborhood ?? '');
  const [photoUrl, setPhotoUrl] = useState(user?.photo_url ?? '');

  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // When the user object changes (e.g. after a save), keep the form in
  // sync so saved values stay shown.
  useEffect(() => {
    setFullName(user?.full_name ?? '');
    setBio(user?.bio ?? '');
    setNeighborhood(user?.neighborhood ?? '');
    setPhotoUrl(user?.photo_url ?? '');
  }, [user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setSavedAt(null);
    if (!fullName.trim()) {
      setErrorMessage('Display name is required.');
      return;
    }
    setIsSaving(true);
    try {
      await authApi.updateMe({
        full_name: fullName.trim(),
        bio: bio.trim() || null,
        neighborhood: neighborhood.trim() || null,
        photo_url: photoUrl.trim() || null,
      });
      await refreshProfile();
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      if (err instanceof ApiError) setErrorMessage(err.message);
      else setErrorMessage('Failed to save profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleteError('');
    if (deleteConfirm !== user?.email) {
      setDeleteError(`Type your email (${user?.email}) to confirm.`);
      return;
    }
    setIsDeleting(true);
    try {
      await authApi.deleteMe();
      // Soft-delete clears the session — log out and bounce to the login page.
      await logout();
      navigate('/login');
    } catch (err) {
      if (err instanceof ApiError) setDeleteError(err.message);
      else setDeleteError('Failed to delete account.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!user) {
    return (
      <section className="page-section">
        <p>Loading profile…</p>
      </section>
    );
  }

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">US5 / US6 — Profile</p>
          <h1>Your Profile</h1>
          <p className="page-description">
            Update the name and details that other members see on your
            tool listings and reservations.
          </p>
        </div>
      </div>

      <div className="profile-layout">
        <form className="profile-form-card" onSubmit={handleSubmit}>
          <h2>Profile details</h2>

          <label>
            Display name *
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              maxLength={255}
              required
            />
          </label>

          <label>
            Email
            <input type="email" value={user.email} disabled />
            <span className="helper-text">
              Email is fixed; contact an admin to change it.
            </span>
          </label>

          <label>
            Neighborhood
            <input
              type="text"
              value={neighborhood}
              onChange={(event) => setNeighborhood(event.target.value)}
              maxLength={255}
              placeholder="e.g. Kaimuki, Honolulu"
            />
          </label>

          <label>
            Photo URL
            <input
              type="url"
              value={photoUrl}
              onChange={(event) => setPhotoUrl(event.target.value)}
              maxLength={500}
              placeholder="https://example.com/avatar.jpg"
            />
            <span className="helper-text">
              Direct URL to a public image. The backend stores this
              string as-is; upload support will come in R2.
            </span>
          </label>

          <label>
            Bio
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="A short description that other members will see."
            />
          </label>

          <button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save profile'}
          </button>

          {errorMessage && (
            <p className="error-message" role="alert">
              {errorMessage}
            </p>
          )}
          {savedAt && (
            <p className="success-message" role="status">
              Saved at {savedAt}.
            </p>
          )}
        </form>

        <aside className="profile-aside">
          <h2>Account stats</h2>
          <dl className="profile-stats">
            <div>
              <dt>Status</dt>
              <dd>{user.status}</dd>
            </div>
            <div>
              <dt>Trust score</dt>
              <dd>{user.trust_score.toFixed(2)}</dd>
            </div>
            <div>
              <dt>Damage reports</dt>
              <dd>{user.damage_reported}</dd>
            </div>
            <div>
              <dt>Violations</dt>
              <dd>{user.violation_count}</dd>
            </div>
            <div>
              <dt>Member since</dt>
              <dd>{new Date(user.created_at).toLocaleDateString()}</dd>
            </div>
            <div>
              <dt>Admin</dt>
              <dd>{user.is_admin ? 'Yes' : 'No'}</dd>
            </div>
          </dl>

          <h2 className="profile-danger-header">US7 — Delete account</h2>
          <p className="profile-danger-help">
            Deleting your account is a soft delete: your listings are
            removed and your personal information is anonymized. Existing
            reservations and reviews are preserved so the other party can
            still see the history. After deletion, you cannot log in with
            this email again.
          </p>
          <p className="profile-danger-help">
            You can only delete your account when you have no active
            reservations. The backend will block the request if any
            reservation is still in REQUESTED, APPROVED, or PICKED_UP.
          </p>
          <label>
            Type your email to confirm
            <input
              type="email"
              value={deleteConfirm}
              onChange={(event) => setDeleteConfirm(event.target.value)}
              placeholder={user.email}
            />
          </label>
          <button
            type="button"
            className="danger-button"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting…' : 'Delete my account'}
          </button>
          {deleteError && (
            <p className="error-message" role="alert">
              {deleteError}
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}

export default ProfilePage;
