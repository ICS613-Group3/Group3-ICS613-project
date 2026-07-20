// Import React runtime hook for local page state.
import { useState } from 'react';

// Import React types only for event typing.
import type { ChangeEvent, FormEvent } from 'react';

// Import routing helpers for access control and dashboard redirect.
import { Navigate, useNavigate } from 'react-router-dom';

// Import the existing authenticated profile API.
import { authApi } from '../api/auth';

// Maximum display-name length for frontend validation.
const maxDisplayNameLength = 40;

// Maximum profile-photo size: 2 MB.
const maxPhotoSizeBytes = 2 * 1024 * 1024;

// Allowed profile-photo MIME types.
const allowedPhotoTypes = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * ProfileSetupPage
 *
 * Frontend issues covered:
 * - #95 Save the profile and redirect to the member dashboard.
 * - #97 Display validation message for missing display name.
 * - #98 Display maximum character limit message.
 * - #99 Display profile photo constraint error message.
 * - #100 Redirect unauthenticated user to login page.
 *
 * Current behavior:
 * - Uses the existing mock login-status check.
 * - Saves supported profile fields through PUT /auth/me.
 * - Redirects only after the backend confirms the save.
 * - Keeps a local profile copy for compatibility with mock frontend pages.
 *
 * Backend limitation:
 * - The current API does not support uploading a profile-photo file.
 */
function ProfileSetupPage() {
  const navigate = useNavigate();

  // Existing mock authentication compatibility.
  const mockAuthKey = 'mockAuthStatus';
  const mockProfileKey = 'mockUserProfile';

  const isLoggedIn =
    localStorage.getItem(mockAuthKey) === 'logged-in';

  const [displayName, setDisplayName] = useState('Yafei Wang');
  const [bio, setBio] = useState('');
  const [photoFileName, setPhotoFileName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Issue #100: redirect unauthenticated users to Login.
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    setErrorMessage('');

    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      setPhotoFileName('');
      return;
    }

    if (!allowedPhotoTypes.includes(selectedFile.type)) {
      setPhotoFileName('');
      event.target.value = '';
      setErrorMessage(
        'Profile photo must be a JPG, PNG, or WebP image.',
      );
      return;
    }

    if (selectedFile.size > maxPhotoSizeBytes) {
      setPhotoFileName('');
      event.target.value = '';
      setErrorMessage(
        'Profile photo must be 2 MB or smaller.',
      );
      return;
    }

    setPhotoFileName(selectedFile.name);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');

    const normalizedDisplayName = displayName.trim();
    const normalizedBio = bio.trim();

    // Issue #97: display name is required.
    if (!normalizedDisplayName) {
      setErrorMessage('Display name is required.');
      return;
    }

    // Issue #98: display name cannot exceed 40 characters.
    if (normalizedDisplayName.length > maxDisplayNameLength) {
      setErrorMessage(
        `Display name must be ${maxDisplayNameLength} characters or fewer.`,
      );
      return;
    }

    setIsSaving(true);

    try {
      // Save the profile through the existing PUT /auth/me API.
      await authApi.updateMe({
        full_name: normalizedDisplayName,
        bio: normalizedBio || null,
      });

      // Preserve compatibility with existing mock frontend pages.
      // Failure to write this optional cache must not override a
      // successful backend profile save.
      try {
        localStorage.setItem(
          mockProfileKey,
          JSON.stringify({
            displayName: normalizedDisplayName,
            bio: normalizedBio,
            photoFileName,
            profileSetupComplete: true,
          }),
        );
      } catch {
        // The backend save is authoritative.
      }

      setSuccessMessage(
        'Profile saved successfully. Redirecting to dashboard...',
      );

      // Issue #95: redirect only after successful profile persistence.
      navigate('/dashboard', { replace: true });
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Unable to save your profile. Please try again.';

      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Profile Setup</p>
          <h1>Set Up Your Profile</h1>
          <p className="page-description">
            Complete your member profile before using the
            tool-sharing dashboard.
          </p>
        </div>
      </div>

      <div className="profile-layout">
        <form
          className="profile-card"
          onSubmit={handleSubmit}
          noValidate
          aria-busy={isSaving}
        >
          <h2>Member Profile</h2>

          <label htmlFor="profile-display-name">
            Display Name
            <input
              id="profile-display-name"
              type="text"
              value={displayName}
              onChange={(event) =>
                setDisplayName(event.target.value)
              }
              maxLength={maxDisplayNameLength + 10}
              required
              disabled={isSaving}
            />
          </label>

          <p className="auth-helper-text">
            {displayName.trim().length}/{maxDisplayNameLength}
            {' '}characters
          </p>

          <label htmlFor="profile-bio">
            Short Bio
            <textarea
              id="profile-bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              rows={4}
              placeholder="Tell neighbors a little about yourself."
              disabled={isSaving}
            />
          </label>

          <label htmlFor="profile-photo">
            Profile Photo
            <input
              id="profile-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoChange}
              disabled={isSaving}
            />
          </label>

          <p className="auth-helper-text">
            Accepted photo types: JPG, PNG, or WebP. Maximum
            size: 2 MB. The selected file is preview-only until
            profile-photo upload support is available.
          </p>

          <button
            className="primary-button"
            type="submit"
            disabled={isSaving}
          >
            {isSaving ? 'Saving Profile...' : 'Save Profile'}
          </button>

          <div aria-live="polite">
            {errorMessage && (
              <p className="form-error">{errorMessage}</p>
            )}

            {successMessage && (
              <p className="form-success">{successMessage}</p>
            )}
          </div>
        </form>

        <aside className="profile-card profile-preview-card">
          <h2>Profile Preview</h2>

          <div className="profile-avatar-preview">
            {photoFileName
              ? photoFileName.slice(0, 1).toUpperCase()
              : '\u{1F464}'}
          </div>

          <h3>
            {displayName.trim() || 'Display Name Required'}
          </h3>

          <p>
            {bio.trim() || 'Your short bio will appear here.'}
          </p>

          <p className="auth-helper-text">
            Photo file: {photoFileName || 'No photo selected'}
          </p>
        </aside>
      </div>
    </section>
  );
}

export default ProfileSetupPage;
