import { useMemo, useState } from 'react';

import type { ChangeEvent, FormEvent } from 'react';

import { Link } from 'react-router-dom';

import {
  categoryLabels,
  mockTools,
  type ToolCategory,
  type ToolCondition,
} from '../data/mockData';

// Latest return time must use 24-hour HH:MM format.
const returnTimePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

// Maximum photo size for frontend validation.
// 5 MB = 5 * 1024 * 1024 bytes.
const maxPhotoSizeBytes = 5 * 1024 * 1024;

// Maximum number of mock photos allowed for one tool listing.
const maxPhotoCount = 5;

// Allowed mock upload photo types.
const allowedPhotoTypes = ['image/jpeg', 'image/png', 'image/webp'];

// Frontend-only uploaded photo preview object.
interface UploadedPhoto {
  id: string;
  name: string;
  previewUrl: string;
}

/**
 * CreateToolPage
 *
 * This page supports US8 Create Tool for the R1 frontend demo.
 *
 * Frontend issues covered:
 * - #114 Display required-field validation message.
 * - #115 Display photo upload error message.
 * - #117 Reject new tool listing when user does not upload photos.
 * - #118 Display return time HH:MM format message.
 * - #120 Display duplicate listing name message.
 *
 * Current R1 behavior:
 * - Uses local form state only.
 * - Uses mockTools data to check duplicate listing names.
 * - Uses frontend-only photo upload previews.
 *
 * Future backend behavior:
 * - Connect handleSubmit() to the backend create tool endpoint.
 * - Backend should enforce the same validation rules.
 */
function CreateToolPage() {
  // Main tool listing form state.
  const [toolName, setToolName] = useState('');
  const [category, setCategory] = useState<ToolCategory | ''>('');
  const [condition, setCondition] = useState<ToolCondition | ''>('');
  const [description, setDescription] = useState('');
  const [availableFrom, setAvailableFrom] = useState('');
  const [availableTo, setAvailableTo] = useState('');
  const [latestReturnTime, setLatestReturnTime] = useState('');
  const [notesForBorrowers, setNotesForBorrowers] = useState('');

  // Uploaded photo previews for frontend demo.
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);

  // Separate error and success messages.
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Category options come from backend-aligned mock enum labels.
  const categoryOptions = useMemo(
    () => Object.entries(categoryLabels) as Array<[ToolCategory, string]>,
    [],
  );

  // Tool condition options.
  const conditionOptions: ToolCondition[] = [
    'New',
    'Like New',
    'Good',
    'Fair',
    'Poor',
  ];

  /**
   * Validate one uploaded photo file.
   *
   * Issue #115:
   * - Shows a photo upload error if the file type is unsupported.
   * - Shows a photo upload error if the file size is too large.
   */
  function validatePhotoFile(file: File) {
    if (!allowedPhotoTypes.includes(file.type)) {
      return 'Photo upload error: tool photos must be JPG, PNG, or WebP images.';
    }

    if (file.size > maxPhotoSizeBytes) {
      return 'Photo upload error: each tool photo must be 5 MB or smaller.';
    }

    return '';
  }

  /**
   * Handle mock photo upload.
   *
   * Current R1 behavior:
   * - Creates a local preview URL.
   * - Does not upload the file to a backend yet.
   */
  function handlePhotoUpload(event: ChangeEvent<HTMLInputElement>) {
    // Clear old messages when user selects a photo.
    setErrorMessage('');
    setSuccessMessage('');

    // Read selected file.
    const selectedFile = event.target.files?.[0];

    // If user cancels file selection, do nothing.
    if (!selectedFile) {
      return;
    }

    // Enforce maximum photo count.
    if (photos.length >= maxPhotoCount) {
      event.target.value = '';
      setErrorMessage(`A tool listing can have a maximum of ${maxPhotoCount} photos.`);
      return;
    }

    // Validate photo type and size.
    const photoError = validatePhotoFile(selectedFile);

    if (photoError) {
      event.target.value = '';
      setErrorMessage(photoError);
      return;
    }

    // Create a local preview URL for the selected photo.
    const newPhoto: UploadedPhoto = {
      id: `${selectedFile.name}-${selectedFile.lastModified}-${Date.now()}`,
      name: selectedFile.name,
      previewUrl: URL.createObjectURL(selectedFile),
    };

    // Add photo to the preview list.
    setPhotos((currentPhotos) => [...currentPhotos, newPhoto]);

    // Clear the file input so the same file can be selected again if needed.
    event.target.value = '';
  }

  /**
   * Remove a photo from the frontend preview list.
   */
  function handleRemovePhoto(photoId: string) {
    setErrorMessage('');
    setSuccessMessage('');

    setPhotos((currentPhotos) =>
      currentPhotos.filter((photo) => photo.id !== photoId),
    );
  }

  /**
   * Check for duplicate tool listing name.
   *
   * Issue #120:
   * - Uses mockTools as the existing listing list.
   * - Real backend should perform the final duplicate check later.
   */
  function hasDuplicateToolName(nameToCheck: string) {
    const normalizedName = nameToCheck.trim().toLowerCase();

    return mockTools.some(
      (tool) => tool.name.trim().toLowerCase() === normalizedName,
    );
  }

  /**
   * Handles mock tool creation.
   *
   * Validation:
   * - Required fields must be completed.
   * - Latest return time must be HH:MM.
   * - Available To cannot be before Available From.
   * - At least one photo is required.
   * - Tool name cannot duplicate an existing listing.
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Clear old messages before validation.
    setErrorMessage('');
    setSuccessMessage('');

    // Normalize text fields.
    const normalizedToolName = toolName.trim();
    const normalizedDescription = description.trim();

    // Issue #114:
    // Required-field validation messages.
    if (!normalizedToolName) {
      setErrorMessage('Tool name is required.');
      return;
    }

    if (!category) {
      setErrorMessage('Category is required.');
      return;
    }

    if (!condition) {
      setErrorMessage('Condition is required.');
      return;
    }

    if (!normalizedDescription) {
      setErrorMessage('Description is required.');
      return;
    }

    if (!availableFrom) {
      setErrorMessage('Available From date is required.');
      return;
    }

    if (!availableTo) {
      setErrorMessage('Available To date is required.');
      return;
    }

    if (!latestReturnTime) {
      setErrorMessage('Latest return time is required.');
      return;
    }

    // Issue #118:
    // Latest return time must be HH:MM.
    if (!returnTimePattern.test(latestReturnTime)) {
      setErrorMessage('Latest return time must use HH:MM format, such as 17:30.');
      return;
    }

    // Date range validation.
    if (availableTo < availableFrom) {
      setErrorMessage('Available To date cannot be before Available From date.');
      return;
    }

    // Issue #117:
    // New tool listing must include at least one photo.
    if (photos.length < 1) {
      setErrorMessage('At least one tool photo is required before creating a listing.');
      return;
    }

    // Issue #120:
    // Duplicate tool listing name message.
    if (hasDuplicateToolName(normalizedToolName)) {
      setErrorMessage(
        'A tool listing with this name already exists. Please use a unique listing name.',
      );
      return;
    }

    // Mock success message for R1 frontend demo.
    setSuccessMessage(
      `Mock tool listing created: ${normalizedToolName}. Category: ${categoryLabels[category]}.`,
    );
  }

  // First uploaded photo becomes the listing preview image.
  const previewImage =
    photos[0]?.previewUrl ||
    `https://placehold.co/600x400?text=${encodeURIComponent(
      toolName || 'New Tool',
    )}`;

  return (
    <section className="page-section">
      {/* Page header and back link. */}
      <div className="page-header">
        <div>
          <p className="eyebrow">Create Tool</p>
          <h1>Add a New Tool Listing</h1>
          <p className="page-description">
            Create a mock tool listing for the R1 demo. Categories match the
            backend enum so this page can be wired to the API later.
          </p>
        </div>

        <Link className="secondary-link" to="/tools">
          Back to Browse Tools
        </Link>
      </div>

      <div className="tool-form-layout">
        {/* Tool listing form. noValidate allows our React messages to show. */}
        <form className="tool-form-card" onSubmit={handleSubmit} noValidate>
          <p className="eyebrow">US8 Create Tool</p>
          <h2>Tool Listing Form</h2>

          <div className="form-grid">
            {/* Required tool name field. */}
            <label htmlFor="create-tool-name">
              Tool Name *
              <input
                id="create-tool-name"
                type="text"
                value={toolName}
                onChange={(event) => setToolName(event.target.value)}
                placeholder="Example: Cordless Drill"
              />
            </label>

            {/* Required category field. */}
            <label htmlFor="create-tool-category">
              Category *
              <select
                id="create-tool-category"
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as ToolCategory | '')
                }
              >
                <option value="">Select category</option>
                {categoryOptions.map(([categoryValue, label]) => (
                  <option key={categoryValue} value={categoryValue}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            {/* Required condition field. */}
            <label htmlFor="create-tool-condition">
              Condition *
              <select
                id="create-tool-condition"
                value={condition}
                onChange={(event) =>
                  setCondition(event.target.value as ToolCondition | '')
                }
              >
                <option value="">Select condition</option>
                {conditionOptions.map((conditionValue) => (
                  <option key={conditionValue} value={conditionValue}>
                    {conditionValue}
                  </option>
                ))}
              </select>
            </label>

            {/* Required latest return time field. */}
            <label htmlFor="create-tool-return-time">
              Latest Return Time *
              <input
                id="create-tool-return-time"
                type="time"
                value={latestReturnTime}
                onChange={(event) => setLatestReturnTime(event.target.value)}
              />
            </label>

            {/* Required availability start date. */}
            <label htmlFor="create-tool-available-from">
              Available From *
              <input
                id="create-tool-available-from"
                type="date"
                value={availableFrom}
                onChange={(event) => setAvailableFrom(event.target.value)}
              />
            </label>

            {/* Required availability end date. */}
            <label htmlFor="create-tool-available-to">
              Available To *
              <input
                id="create-tool-available-to"
                type="date"
                value={availableTo}
                onChange={(event) => setAvailableTo(event.target.value)}
              />
            </label>
          </div>

          {/* Required description field. */}
          <label htmlFor="create-tool-description">
            Description *
            <textarea
              id="create-tool-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe the tool and what it can be used for."
              rows={4}
            />
          </label>

          {/* Optional borrower notes field. */}
          <label htmlFor="create-tool-notes">
            Notes for Borrowers
            <textarea
              id="create-tool-notes"
              value={notesForBorrowers}
              onChange={(event) => setNotesForBorrowers(event.target.value)}
              placeholder="Example: Please clean before returning."
              rows={3}
            />
          </label>

          {/* Required photo upload for issues #115 and #117. */}
          <label htmlFor="create-tool-photo">
            Tool Photos *
            <input
              id="create-tool-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoUpload}
            />
          </label>

          <p className="auth-helper-text">
            Upload at least one photo. Accepted photo types: JPG, PNG, or WebP.
            Maximum size: 5 MB each.
          </p>

          {/* Uploaded photo preview list. */}
          {photos.length > 0 && (
            <div className="photo-list">
              {photos.map((photo, index) => (
                <article className="photo-list-item" key={photo.id}>
                  <img src={photo.previewUrl} alt={`${toolName} photo ${index + 1}`} />

                  <div>
                    <strong>
                      Photo {index + 1}
                      {index === 0 ? ' - Thumbnail' : ''}
                    </strong>
                    <p>{photo.name}</p>

                    <button
                      type="button"
                      className="secondary-button small-button"
                      onClick={() => handleRemovePhoto(photo.id)}
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          <p className="hst-note">
            Availability dates are interpreted in Hawaii Standard Time HST.
            Latest return time must use HH:MM format.
          </p>

          {/* Submit button. */}
          <button className="primary-button" type="submit">
            Create Mock Tool Listing
          </button>

          {/* Validation and success messages. */}
          {errorMessage && <p className="form-error">{errorMessage}</p>}
          {successMessage && (
            <div className="success-message" role="status">
              {successMessage}
            </div>
          )}
        </form>

        {/* Live preview card. */}
        <aside className="tool-preview-card">
          <p className="eyebrow">Preview</p>
          <h2>Listing Preview</h2>

          <img src={previewImage} alt="Tool preview" className="tool-preview-image" />

          <div className="tool-card-top">
            <span className="status-badge">
              {category ? categoryLabels[category] : 'Category'}
            </span>
            <span className="rating">Rating: New</span>
          </div>

          <h3>{toolName || 'New Tool Name'}</h3>
          <p>{description || 'Tool description will appear here.'}</p>

          <dl className="detail-meta-grid">
            <div>
              <dt>Condition</dt>
              <dd>{condition || 'Not selected'}</dd>
            </div>

            <div>
              <dt>Latest return</dt>
              <dd>{latestReturnTime || '--:--'} HST</dd>
            </div>

            <div>
              <dt>Available from</dt>
              <dd>{availableFrom || 'Not selected'}</dd>
            </div>

            <div>
              <dt>Available to</dt>
              <dd>{availableTo || 'Not selected'}</dd>
            </div>
          </dl>

          <p className="auth-helper-text">
            Uploaded photos: {photos.length}/{maxPhotoCount}
          </p>

          {notesForBorrowers && (
            <div className="info-panel">
              <h3>Borrower Notes</h3>
              <p>{notesForBorrowers}</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

export default CreateToolPage;
