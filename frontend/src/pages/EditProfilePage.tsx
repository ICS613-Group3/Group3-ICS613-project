import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';

import { authApi } from '../api/auth';
import { useAuth } from '../context/useAuth';
import { ApiRequestError } from '../api/client';

const maxDisplayNameLength = 40;

function EditProfilePage() {
  const { user, isLoading: authLoading } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.full_name || '');
      setBio(user.bio || '');
    }
  }, [user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const normalizedDisplayName = displayName.trim();
    if (!normalizedDisplayName) {
      setErrorMessage('Display name is required.');
      return;
    }
    if (normalizedDisplayName.length > maxDisplayNameLength) {
      setErrorMessage(`Display name must be ${maxDisplayNameLength} characters or fewer.`);
      return;
    }

    setIsSaving(true);
    try {
      await authApi.updateMe({
        full_name: normalizedDisplayName,
        bio: bio.trim() || undefined,
      });
      setSuccessMessage('Profile changes saved successfully.');
    } catch (err: unknown) {
      const msg = err instanceof ApiRequestError ? err.detail : 'Failed to save profile.';
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading) {
    return <section className="page-section"><div className="page-header"><h1>Loading...</h1></div></section>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Member Profile</p>
          <h1>Edit Profile</h1>
          <p className="page-description">
            Update your display name and short bio.
          </p>
        </div>
        <Link className="secondary-link header-action-link" to="/dashboard">
          Back to Dashboard
        </Link>
      </div>

      <div className="profile-layout">
        <form className="profile-card" onSubmit={handleSubmit} noValidate>
          <h2>Profile Details</h2>

          <label htmlFor="edit-profile-display-name">
            Display Name
            <input
              id="edit-profile-display-name"
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={maxDisplayNameLength + 10}
              required
            />
          </label>

          <p className="auth-helper-text">
            {displayName.trim().length}/{maxDisplayNameLength} characters
          </p>

          <label htmlFor="edit-profile-bio">
            Short Bio
            <textarea
              id="edit-profile-bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              rows={4}
              placeholder="Tell neighbors a little about yourself."
            />
          </label>

          <button className="primary-button" type="submit" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>

          {errorMessage && <p className="form-error">{errorMessage}</p>}
          {successMessage && <p className="form-success">{successMessage}</p>}
        </form>

        <aside className="profile-card profile-preview-card">
          <h2>Profile Preview</h2>
          <h3>{displayName.trim() || 'Display Name Required'}</h3>
          <p>{bio.trim() || 'Your short bio will appear here.'}</p>
        </aside>
      </div>
    </section>
  );
}

export default EditProfilePage;
