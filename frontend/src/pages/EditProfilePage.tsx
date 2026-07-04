import { useState } from 'react';

import type { ChangeEvent, FormEvent } from 'react';

import { Link, Navigate } from 'react-router-dom';

// Maximum display name length for frontend validation.
const maxDisplayNameLength = 40;

// Maximum profile photo size for frontend validation.
// 2 MB = 2 * 1024 * 1024 bytes.
const maxPhotoSizeBytes = 2 * 1024 * 1024;

// Allowed profile photo MIME types.
const allowedPhotoTypes = ['image/jpeg', 'image/png', 'image/webp'];

// Define the shape of the mock profile stored in localStorage.
interface MockUserProfile {
  displayName: string;
  bio: string;
  photoFileName: string;
  profileSetupComplete: boolean;
}

/**
 * getInitialProfile
 *
 * Reads the mock user profile from localStorage.
 *
 * Current R1 behavior:
 * - If profile data exists, use it.
 * - If profile data does not exist, show safe demo defaults.
 *
 * Future backend behavior:
 * - Replace this with a real profile API call.
 */
function getInitialProfile(): MockUserProfile {
  // localStorage key shared with ProfileSetupPage.
  const mockProfileKey = 'mockUserProfile';

  // Read saved mock profile data.
  const savedProfile = localStorage.getItem(mockProfileKey);

  // If there is no saved profile, return demo defaults.
  if (!savedProfile) {
    return {
      displayName: 'Yafei Wang',
      bio: '',
      photoFileName: '',
      profileSetupComplete: false,
    };
  }

  try {
    // Parse the saved profile data.
    const parsedProfile = JSON.parse(savedProfile) as Partial<MockUserProfile>;

    // Return parsed values with safe fallback defaults.
    return {
      displayName: parsedProfile.displayName ?? 'Yafei Wang',
      bio: parsedProfile.bio ?? '',
      photoFileName: parsedProfile.photoFileName ?? '',
      profileSetupComplete: parsedProfile.profileSetupComplete ?? false,
    };
  } catch {
    // If localStorage data is broken, return safe demo defaults.
    return {
      displayName: 'Yafei Wang',
      bio: '',
      photoFileName: '',
      profileSetupComplete: false,
    };
  }
}

/**
 * EditProfilePage
 *
 * Frontend issue covered:
 * - #102 Add an edit profile page.
 *
 * Related validation behavior:
 * - Display name is required.
 * - Display name cannot exceed the maximum character limit.
 * - Profile photo must be JPG, PNG, or WebP.
 * - Profile photo must be 2 MB or smaller.
 *
 * Current behavior:
 * - Frontend mock/demo page only.
 * - Reads and writes profile data using localStorage.
 * - Redirects unauthenticated users to Login using mock auth.
 *
 * Future backend behavior:
 * - Replace localStorage with backend profile API.
 * - Backend should enforce authentication and validation.
 */
function EditProfilePage() {
  // localStorage key used by LoginPage, RegisterPage, and AppLayout for mock auth.
  const mockAuthKey = 'mockAuthStatus';

  // localStorage key shared with ProfileSetupPage.
  const mockProfileKey = 'mockUserProfile';

  // Check whether user is logged in using mock frontend auth.
  const isLoggedIn = localStorage.getItem(mockAuthKey) === 'logged-in';

  // Load initial profile data from localStorage.
  const initialProfile = getInitialProfile();

  // Store editable display name.
  const [displayName, setDisplayName] = useState(initialProfile.displayName);

  // Store editable short bio.
  const [bio, setBio] = useState(initialProfile.bio);

  // Store selected or saved profile photo file name.
  const [photoFileName, setPhotoFileName] = useState(initialProfile.photoFileName);

  // Store validation error messages.
  const [errorMessage, setErrorMessage] = useState('');

  // Store success message after saving profile changes.
  const [successMessage, setSuccessMessage] = useState('');

  /**
   * Redirect unauthenticated users to Login.
   *
   * Important:
   * - This protects the route on the frontend for better user experience.
   * - Backend authorization is still required later.
   */
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  /**
   * Validate selected profile photo.
   *
   * Rules:
   * - Photo is optional.
   * - If selected, it must be JPG, PNG, or WebP.
   * - If selected, it must be 2 MB or smaller.
   */
  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    // Clear old messages when the user selects a new file.
    setErrorMessage('');
    setSuccessMessage('');

    // Read the first selected file.
    const selectedFile = event.target.files?.[0];

    // If user clears the file input, do not change the saved photo name.
    if (!selectedFile) {
      return;
    }

    // Reject unsupported image file types.
    if (!allowedPhotoTypes.includes(selectedFile.type)) {
      event.target.value = '';
      setErrorMessage('Profile photo must be a JPG, PNG, or WebP image.');
      return;
    }

    // Reject image files that are too large.
    if (selectedFile.size > maxPhotoSizeBytes) {
      event.target.value = '';
      setErrorMessage('Profile photo must be 2 MB or smaller.');
      return;
    }

    // Save the selected file name for frontend preview text.
    setPhotoFileName(selectedFile.name);
  }

  /**
   * Remove selected profile photo from the mock profile.
   *
   * Current frontend behavior:
   * - Clears only the displayed file name.
   * - No real file upload/delete happens in R1 mock mode.
   */
  function handleRemovePhoto() {
    // Clear old messages before removing photo.
    setErrorMessage('');
    setSuccessMessage('');

    // Clear mock profile photo file name.
    setPhotoFileName('');
  }

  /**
   * Handle edit profile submit.
   *
   * Validation:
   * - Display name is required.
   * - Display name cannot be longer than 40 characters.
   * - Profile photo validation happens when file is selected.
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Clear old messages before validating the new submit.
    setErrorMessage('');
    setSuccessMessage('');

    // Normalize display name before validation.
    const normalizedDisplayName = displayName.trim();

    // Show validation message when display name is missing.
    if (!normalizedDisplayName) {
      setErrorMessage('Display name is required.');
      return;
    }

    // Show maximum character limit message.
    if (normalizedDisplayName.length > maxDisplayNameLength) {
      setErrorMessage(
        `Display name must be ${maxDisplayNameLength} characters or fewer.`,
      );
      return;
    }

    // Save updated mock profile data.
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

    // Confirm that profile changes were saved.
    setSuccessMessage('Profile changes saved successfully.');
  }

  return (
    <section className="page-section">
      {/* Page header explains the edit profile workflow. */}
      <div className="page-header">
        <div>
          <p className="eyebrow">Member Profile</p>
          <h1>Edit Profile</h1>
          <p className="page-description">
            Update your display name, short bio, and optional profile photo.
          </p>
        </div>

        {/* Header action returns user to Dashboard. */}
        <Link className="secondary-link header-action-link" to="/dashboard">
          Back to Dashboard
        </Link>
      </div>

      {/* Profile edit layout includes the form and a live preview card. */}
      <div className="profile-layout">
        {/* Edit profile form card. */}
        <form className="profile-card" onSubmit={handleSubmit} noValidate>
          <h2>Profile Details</h2>

          {/* Display name field with required and max-length validation. */}
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

          {/* Character counter helps the user stay under the limit. */}
          <p className="auth-helper-text">
            {displayName.trim().length}/{maxDisplayNameLength} characters
          </p>

          {/* Optional short bio field. */}
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

          {/* Optional profile photo upload field. */}
          <label htmlFor="edit-profile-photo">
            Profile Photo
            <input
              id="edit-profile-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoChange}
            />
          </label>

          {/* Photo constraint helper text. */}
          <p className="auth-helper-text">
            Accepted photo types: JPG, PNG, or WebP. Maximum size: 2 MB.
          </p>

          {/* Remove photo button only appears when a mock photo is selected/saved. */}
          {photoFileName && (
            <button
              className="secondary-button"
              type="button"
              onClick={handleRemovePhoto}
            >
              Remove Photo
            </button>
          )}

          {/* Save profile changes button. */}
          <button className="primary-button" type="submit">
            Save Changes
          </button>

          {/* Inline validation and success messages. */}
          {errorMessage && <p className="form-error">{errorMessage}</p>}
          {successMessage && <p className="form-success">{successMessage}</p>}
        </form>

        {/* Live preview card helps user see the updated profile. */}
        <aside className="profile-card profile-preview-card">
          <h2>Profile Preview</h2>

          <div className="profile-avatar-preview">
            {photoFileName ? photoFileName.slice(0, 1).toUpperCase() : '👤'}
          </div>

          <h3>{displayName.trim() || 'Display Name Required'}</h3>

          <p>{bio.trim() || 'Your short bio will appear here.'}</p>

          <p className="auth-helper-text">
            Photo file: {photoFileName || 'No photo selected'}
          </p>

          <p className="auth-helper-text">
            Demo note: profile changes are saved in localStorage for R1 frontend
            testing.
          </p>
        </aside>
      </div>
    </section>
  );
}

export default EditProfilePage;
