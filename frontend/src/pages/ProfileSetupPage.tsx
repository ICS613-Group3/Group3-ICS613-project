// Import React runtime hook for local page state.
import { useState } from 'react';

// Import React type only for form submit event typing.
// This is required because verbatimModuleSyntax is enabled.
import type { ChangeEvent, FormEvent } from 'react';

// Import Navigate for protected route behavior and useNavigate for redirect after setup.
import { Navigate, useNavigate } from 'react-router-dom';

// Maximum display name length for frontend validation.
const maxDisplayNameLength = 40;

// Maximum profile photo size for frontend validation.
// 2 MB = 2 * 1024 * 1024 bytes.
const maxPhotoSizeBytes = 2 * 1024 * 1024;

// Allowed profile photo MIME types.
const allowedPhotoTypes = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * ProfileSetupPage
 *
 * Frontend issues covered:
 * - #95 Redirect to member dashboard after successful profile setup.
 * - #97 Display validation message for missing display name.
 * - #98 Display maximum character limit message.
 * - #99 Display profile photo constraint error message.
 * - #100 Redirect unauthenticated user to login page.
 *
 * Current behavior:
 * - Frontend mock/demo page only.
 * - Uses localStorage to check mock login status.
 * - Saves mock profile data to localStorage.
 *
 * Future backend behavior:
 * - Replace localStorage save with backend profile API.
 * - Backend should still enforce authentication and validation.
 */
function ProfileSetupPage() {
  // React Router navigation after successful profile setup.
  const navigate = useNavigate();

  // localStorage key used by LoginPage, RegisterPage, and AppLayout for mock auth.
  const mockAuthKey = 'mockAuthStatus';

  // localStorage key for mock profile data.
  const mockProfileKey = 'mockUserProfile';

  // Check whether the user is logged in using mock frontend auth.
  const isLoggedIn = localStorage.getItem(mockAuthKey) === 'logged-in';

  // Store display name typed by the user.
  const [displayName, setDisplayName] = useState('Yafei Wang');

  // Store optional bio typed by the user.
  const [bio, setBio] = useState('');

  // Store selected profile photo file name for preview text.
  const [photoFileName, setPhotoFileName] = useState('');

  // Store frontend validation error message.
  const [errorMessage, setErrorMessage] = useState('');

  // Store success message before redirect.
  const [successMessage, setSuccessMessage] = useState('');

  /**
   * Issue #100:
   * Redirect unauthenticated users to Login.
   *
   * Important:
   * - This is frontend-only route protection.
   * - Real backend authorization is still required later.
   */
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  /**
   * Validate selected profile photo.
   *
   * Rules:
   * - Photo is optional.
   * - If selected, it must be JPEG, PNG, or WebP.
   * - If selected, it must be 2 MB or smaller.
   */
  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    // Clear old photo error when user chooses a new file.
    setErrorMessage('');

    // Get the first selected file.
    const selectedFile = event.target.files?.[0];

    // If user clears the file input, clear the preview file name.
    if (!selectedFile) {
      setPhotoFileName('');
      return;
    }

    // Issue #99:
    // Reject unsupported image file types.
    if (!allowedPhotoTypes.includes(selectedFile.type)) {
      setPhotoFileName('');
      event.target.value = '';
      setErrorMessage('Profile photo must be a JPG, PNG, or WebP image.');
      return;
    }

    // Issue #99:
    // Reject image files that are too large.
    if (selectedFile.size > maxPhotoSizeBytes) {
      setPhotoFileName('');
      event.target.value = '';
      setErrorMessage('Profile photo must be 2 MB or smaller.');
      return;
    }

    // Save the file name for frontend preview text.
    setPhotoFileName(selectedFile.name);
  }

  /**
   * Handle profile setup submit.
   *
   * Validation:
   * - Display name is required.
   * - Display name cannot be longer than 40 characters.
   * - Profile photo validation happens when file is selected.
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Clear old messages before validating new submit.
    setErrorMessage('');
    setSuccessMessage('');

    // Normalize display name before validation.
    const normalizedDisplayName = displayName.trim();

    // Issue #97:
    // Show validation message when display name is missing.
    if (!normalizedDisplayName) {
      setErrorMessage('Display name is required.');
      return;
    }

    // Issue #98:
    // Show maximum character limit message.
    if (normalizedDisplayName.length > maxDisplayNameLength) {
      setErrorMessage(
        `Display name must be ${maxDisplayNameLength} characters or fewer.`,
      );
      return;
    }

    // Save mock profile data.
    // Real backend version should send this data to a profile API.
    localStorage.setItem(
      mockProfileKey,
      JSON.stringify({
        displayName: normalizedDisplayName,
        bio: bio.trim(),
        photoFileName,
        profileSetupComplete: true,
      }),
    );

    // Show success message for demo.
    setSuccessMessage('Profile setup complete. Redirecting to dashboard...');

    // Issue #95:
    // Redirect to member dashboard after successful profile setup.
    window.setTimeout(() => {
      navigate('/dashboard');
    }, 600);
  }

  return (
    <section className="page-section">
      {/* Page header explains the profile setup workflow. */}
      <div className="page-header">
        <div>
          <p className="eyebrow">Profile Setup</p>
          <h1>Set Up Your Profile</h1>
          <p className="page-description">
            Complete your member profile before using the tool-sharing dashboard.
          </p>
        </div>
      </div>

      {/* Profile setup layout includes the form and a live preview card. */}
      <div className="profile-layout">
        {/* Profile setup form card. */}
        <form className="profile-card" onSubmit={handleSubmit} noValidate>
          <h2>Member Profile</h2>

          {/* Display name field for issues #97 and #98. */}
          <label htmlFor="profile-display-name">
            Display Name
            <input
              id="profile-display-name"
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

          {/* Optional profile bio field. */}
          <label htmlFor="profile-bio">
            Short Bio
            <textarea
              id="profile-bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              rows={4}
              placeholder="Tell neighbors a little about yourself."
            />
          </label>

          {/* Optional profile photo upload field for issue #99. */}
          <label htmlFor="profile-photo">
            Profile Photo
            <input
              id="profile-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoChange}
            />
          </label>

          <p className="auth-helper-text">
            Accepted photo types: JPG, PNG, or WebP. Maximum size: 2 MB.
          </p>

          {/* Submit button for profile setup. */}
          <button className="primary-button" type="submit">
            Save Profile
          </button>

          {/* Inline validation and success messages. */}
          {errorMessage && <p className="form-error">{errorMessage}</p>}
          {successMessage && <p className="form-success">{successMessage}</p>}
        </form>

        {/* Live preview card helps user see what their profile will look like. */}
        <aside className="profile-card profile-preview-card">
          <h2>Profile Preview</h2>

          <div className="profile-avatar-preview">
            {photoFileName ? photoFileName.slice(0, 1).toUpperCase() : 'ðŸ‘¤'}
          </div>

          <h3>{displayName.trim() || 'Display Name Required'}</h3>

          <p>{bio.trim() || 'Your short bio will appear here.'}</p>

          <p className="auth-helper-text">
            Photo file: {photoFileName || 'No photo selected'}
          </p>
        </aside>
      </div>
    </section>
  );
}

export default ProfileSetupPage;
