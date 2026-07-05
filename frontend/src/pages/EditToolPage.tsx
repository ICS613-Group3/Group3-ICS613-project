import { useMemo, useState } from 'react';

import type { ChangeEvent, FormEvent } from 'react';

import { Link, useParams } from 'react-router-dom';

import {
  categoryLabels,
  mockReservations,
  mockTools,
  type ToolCategory,
  type ToolCondition,
} from '../data/mockData';

// Latest return time must use 24-hour HH:MM HST format.
const returnTimePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

// Maximum photo size for frontend validation.
// 5 MB = 5 * 1024 * 1024 bytes.
const maxPhotoSizeBytes = 5 * 1024 * 1024;

// Maximum number of mock photos allowed for one tool listing.
const maxPhotoCount = 5;

// Allowed mock upload photo types.
const allowedPhotoTypes = ['image/jpeg', 'image/png', 'image/webp'];

// Mock logged-in user for the R1 frontend demo.
// In the real app, this will come from AuthContext / backend session.
const currentMockUserId = 'user-1';

// Reservation statuses that block delete/deactivate for US10.
// REQUESTED, APPROVED, and PICKED_UP are still active workflow states.
const activeReservationStatuses = ['REQUESTED', 'APPROVED', 'PICKED_UP'];

/**
 * EditToolPage
 *
 * This page supports:
 * - US9 Edit a Tool Listing and Manage Photos.
 * - US10 Delete or Deactivate a Tool Listing.
 *
 * Existing frontend issues supported:
 * - #114 Display required-field validation message.
 * - #115 Display photo upload error message.
 * - #118 Display return time HH:MM 24-hour HST format message.
 * - #120 Display duplicate listing name message.
 * - #122 Create edit functionality on tool listing.
 *
 * New US10 frontend behavior:
 * - Shows delete/deactivate tool listing UI.
 * - Shows active-reservation block message.
 * - Requires a reason for deactivation.
 * - Requires typing DELETE before mock deletion.
 * - Shows owner-only warning for non-owner tools.
 *
 * Important:
 * - This is frontend-only mock behavior.
 * - It does NOT save to the backend yet.
 * - Backend can later connect:
 *   - PATCH /tools/:id for edits.
 *   - PATCH /tools/:id/deactivate for deactivation.
 *   - DELETE /tools/:id or PATCH soft-delete endpoint for deletion.
 */
function EditToolPage() {
  // Read toolId from URL, for example /tools/tool-1/edit.
  const { toolId } = useParams();

  // Find the selected tool from mock data.
  const tool = useMemo(
    () => mockTools.find((currentTool) => currentTool.id === toolId),
    [toolId],
  );

  // Form state uses the selected tool as initial values when available.
  const [name, setName] = useState(tool?.name ?? '');
  const [category, setCategory] = useState<ToolCategory | ''>(
    tool?.category ?? '',
  );
  const [condition, setCondition] = useState<ToolCondition | ''>(
    tool?.condition ?? '',
  );
  const [latestReturnTime, setLatestReturnTime] = useState(
    tool?.latestReturnTime ?? '',
  );
  const [availableFrom, setAvailableFrom] = useState(tool?.availableFrom ?? '');
  const [availableTo, setAvailableTo] = useState(tool?.availableTo ?? '');
  const [description, setDescription] = useState(tool?.description ?? '');
  const [notes, setNotes] = useState(tool?.notesForBorrowers ?? '');

  // Photo URLs include existing mock image URLs and local object URLs.
  const [photoUrls, setPhotoUrls] = useState<string[]>(
    tool?.imageUrl ? [tool.imageUrl] : [],
  );

  // New photo URL input for mock URL-based photo add behavior.
  const [newPhotoUrl, setNewPhotoUrl] = useState('');

  // UI feedback messages.
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // US10 listing lifecycle state for frontend-only demo.
  // This lets the UI show ACTIVE, DEACTIVATED, or DELETED without backend save.
  const [listingState, setListingState] = useState<
    'ACTIVE' | 'DEACTIVATED' | 'DELETED'
  >('ACTIVE');

  // US10 deactivation reason input.
  const [deactivationReason, setDeactivationReason] = useState('');

  // US10 delete confirmation input.
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

  // US10 demo control.
  // This allows testing the success path even if mock active reservations exist.
  const [pretendReservationsResolved, setPretendReservationsResolved] =
    useState(false);

  // Dropdown options.
  const categoryOptions = Object.entries(categoryLabels) as [
    ToolCategory,
    string,
  ][];

  // Tool condition options.
  const conditionOptions: ToolCondition[] = [
    'New',
    'Like New',
    'Good',
    'Fair',
    'Poor',
  ];

  /**
   * If the URL has a bad toolId, show a clear error page.
   * This prevents the form from crashing when tool is undefined.
   */
  if (!tool) {
    return (
      <section className="page-section">
        <div className="tool-form-card">
          <p className="eyebrow">Edit Tool</p>
          <h1>Tool not found</h1>
          <p className="page-description">
            The tool you are trying to edit does not exist in the mock data.
          </p>

          <Link className="secondary-link" to="/tools">
            Back to Browse Tools
          </Link>
        </div>
      </section>
    );
  }

  /**
   * R1 mock rule:
   * We simulate the rule that editing should be blocked when a tool is PICKED_UP.
   *
   * Since this page is mock-only, tool-3 is used as a demo blocked listing.
   * Later, backend API should return the real editable/not-editable status.
   */
  const isEditBlockedBecausePickedUp = tool.id === 'tool-3';

  // Save the current tool id after the not-found guard.
  // This avoids TypeScript saying tool is possibly undefined inside helper functions.
  const currentToolId = tool.id;

  // US10 mock ownership check.
  // Current mock user is user-1 / Yafei Wang.
  const isCurrentUserOwner = tool.ownerId === currentMockUserId;

  // US10 active reservations for this selected tool.
  // These block delete/deactivate unless the demo override checkbox is used.
  const activeReservationsForTool = mockReservations.filter(
    (reservation) =>
      reservation.toolId === tool.id &&
      activeReservationStatuses.includes(reservation.status),
  );

  // US10 final block decision.
  const isBlockedByActiveReservations =
    activeReservationsForTool.length > 0 && !pretendReservationsResolved;

  // US10 destructive actions should be disabled after mock deletion.
  const isListingDeleted = listingState === 'DELETED';

  // US10 edit form should be disabled when listing is deleted.
  const isEditFormDisabled = isEditBlockedBecausePickedUp || isListingDeleted;

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
   * Validate a mock photo URL.
   *
   * Current R1 behavior:
   * - Allows image URLs that start with http:// or https://.
   * - Real backend can later validate or upload image files.
   */
  function isValidPhotoUrl(value: string) {
    try {
      const parsedUrl = new URL(value);
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Adds one mock photo URL.
   */
  function handleAddPhotoUrl() {
    setErrorMessage('');
    setSuccessMessage('');

    const trimmedPhotoUrl = newPhotoUrl.trim();

    if (isListingDeleted) {
      setErrorMessage('This listing has been deleted in the mock demo.');
      return;
    }

    if (!trimmedPhotoUrl) {
      setErrorMessage('Please enter a photo URL before adding.');
      return;
    }

    if (!isValidPhotoUrl(trimmedPhotoUrl)) {
      setErrorMessage(
        'Photo upload error: please enter a valid photo URL beginning with http:// or https://.',
      );
      return;
    }

    if (photoUrls.length >= maxPhotoCount) {
      setErrorMessage(`A tool listing can have a maximum of ${maxPhotoCount} photos.`);
      return;
    }

    setPhotoUrls((currentPhotoUrls) => [...currentPhotoUrls, trimmedPhotoUrl]);
    setNewPhotoUrl('');
  }

  /**
   * Adds one frontend-only uploaded photo preview.
   */
  function handlePhotoUpload(event: ChangeEvent<HTMLInputElement>) {
    setErrorMessage('');
    setSuccessMessage('');

    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    if (isListingDeleted) {
      event.target.value = '';
      setErrorMessage('This listing has been deleted in the mock demo.');
      return;
    }

    if (photoUrls.length >= maxPhotoCount) {
      event.target.value = '';
      setErrorMessage(`A tool listing can have a maximum of ${maxPhotoCount} photos.`);
      return;
    }

    const photoError = validatePhotoFile(selectedFile);

    if (photoError) {
      event.target.value = '';
      setErrorMessage(photoError);
      return;
    }

    const previewUrl = URL.createObjectURL(selectedFile);

    setPhotoUrls((currentPhotoUrls) => [...currentPhotoUrls, previewUrl]);

    event.target.value = '';
  }

  /**
   * Removes one mock photo.
   * At least one photo must remain on an edit listing.
   */
  function handleRemovePhoto(photoIndex: number) {
    setErrorMessage('');
    setSuccessMessage('');

    if (isListingDeleted) {
      setErrorMessage('This listing has been deleted in the mock demo.');
      return;
    }

    if (photoUrls.length <= 1) {
      setErrorMessage('At least one photo is required for the listing.');
      return;
    }

    setPhotoUrls((currentPhotoUrls) =>
      currentPhotoUrls.filter((_, index) => index !== photoIndex),
    );
  }

  /**
   * Moves a photo up or down in the mock photo list.
   * The first photo acts as the thumbnail.
   */
  function handleMovePhoto(photoIndex: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? photoIndex - 1 : photoIndex + 1;

    if (targetIndex < 0 || targetIndex >= photoUrls.length) {
      return;
    }

    const updatedPhotos = [...photoUrls];
    const currentPhoto = updatedPhotos[photoIndex];

    updatedPhotos[photoIndex] = updatedPhotos[targetIndex];
    updatedPhotos[targetIndex] = currentPhoto;

    setPhotoUrls(updatedPhotos);
  }

  /**
   * Check duplicate listing name.
   *
   * Issue #120:
   * - Allows the current tool to keep its own name.
   * - Blocks using the same name as another mock listing.
   */
  function hasDuplicateToolName(nameToCheck: string) {
    const normalizedName = nameToCheck.trim().toLowerCase();

    return mockTools.some(
      (currentTool) =>
        currentTool.id !== currentToolId &&
        currentTool.name.trim().toLowerCase() === normalizedName,
    );
  }

  /**
   * Mock save handler.
   *
   * Validation:
   * - Required fields must be completed.
   * - Latest return time must be HH:MM 24-hour HST format.
   * - Available To cannot be before Available From.
   * - At least one photo is required.
   * - Tool name cannot duplicate another existing listing.
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage('');
    setSuccessMessage('');

    if (isListingDeleted) {
      setErrorMessage('This listing has been deleted in the mock demo.');
      return;
    }

    if (isEditBlockedBecausePickedUp) {
      setErrorMessage(
        'This listing cannot be edited while the tool is currently PICKED_UP.',
      );
      return;
    }

    const normalizedName = name.trim();
    const normalizedDescription = description.trim();

    // Issue #114:
    // Required-field validation messages.
    if (!normalizedName) {
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
      setErrorMessage('Available From date (HST) is required.');
      return;
    }

    if (!availableTo) {
      setErrorMessage('Available To date (HST) is required.');
      return;
    }

    if (!latestReturnTime) {
      setErrorMessage('Latest return time (HST) is required.');
      return;
    }

    // Issue #118:
    // Latest return time must be HH:MM.
    if (!returnTimePattern.test(latestReturnTime)) {
      setErrorMessage('Latest return time must use HH:MM 24-hour HST format, such as 17:30.');
      return;
    }

    if (availableTo < availableFrom) {
      setErrorMessage('Available To date (HST) cannot be before Available From date (HST).');
      return;
    }

    if (photoUrls.length < 1) {
      setErrorMessage('At least one photo is required for the listing.');
      return;
    }

    // Issue #120:
    // Duplicate listing name message.
    if (hasDuplicateToolName(normalizedName)) {
      setErrorMessage(
        'A tool listing with this name already exists. Please use a unique listing name.',
      );
      return;
    }

    setSuccessMessage(
      `Mock update saved for ${normalizedName}. This is frontend-only and not saved to the backend yet.`,
    );
  }

  /**
   * US10 mock deactivate handler.
   *
   * Frontend behavior:
   * - Only owner can deactivate.
   * - Active reservations block deactivation.
   * - Reason is required.
   * - Listing state changes to DEACTIVATED locally.
   */
  function handleDeactivateListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage('');
    setSuccessMessage('');

    if (!isCurrentUserOwner) {
      setErrorMessage('Only the tool owner can deactivate this listing.');
      return;
    }

    if (isListingDeleted) {
      setErrorMessage('This listing has already been deleted in the mock demo.');
      return;
    }

    if (isBlockedByActiveReservations) {
      setErrorMessage(
        'This listing cannot be deactivated because it has active reservations.',
      );
      return;
    }

    if (!deactivationReason.trim()) {
      setErrorMessage('A deactivation reason is required.');
      return;
    }

    setListingState('DEACTIVATED');
    setSuccessMessage(
      `Mock listing deactivated. Reason: ${deactivationReason.trim()}`,
    );
  }

  /**
   * US10 mock reactivate handler.
   *
   * This is useful for the demo so the team can see the status change both ways.
   * Real backend can later connect this to an admin or owner reactivation endpoint.
   */
  function handleReactivateListing() {
    setErrorMessage('');
    setSuccessMessage('');

    if (!isCurrentUserOwner) {
      setErrorMessage('Only the tool owner can reactivate this listing.');
      return;
    }

    if (isListingDeleted) {
      setErrorMessage('This listing has been deleted and cannot be reactivated.');
      return;
    }

    setListingState('ACTIVE');
    setSuccessMessage('Mock listing reactivated and visible again.');
  }

  /**
   * US10 mock delete handler.
   *
   * Frontend behavior:
   * - Only owner can delete.
   * - Active reservations block deletion.
   * - User must type DELETE.
   * - Listing state changes to DELETED locally.
   */
  function handleDeleteListing() {
    setErrorMessage('');
    setSuccessMessage('');

    if (!isCurrentUserOwner) {
      setErrorMessage('Only the tool owner can delete this listing.');
      return;
    }

    if (isListingDeleted) {
      setErrorMessage('This listing has already been deleted in the mock demo.');
      return;
    }

    if (isBlockedByActiveReservations) {
      setErrorMessage(
        'This listing cannot be deleted because it has active reservations.',
      );
      return;
    }

    if (deleteConfirmationText !== 'DELETE') {
      setErrorMessage('Type DELETE to confirm mock listing deletion.');
      return;
    }

    setListingState('DELETED');
    setSuccessMessage(
      'Mock listing deleted. This is frontend-only and not saved to the backend yet.',
    );
  }

  return (
    <section className="page-section">
      {/* Page header and navigation actions. */}
      <div className="page-header">
        <div>
          <p className="eyebrow">US9 + US10 Tool Management</p>
          <h1>Edit / Delete / Deactivate Tool Listing</h1>
          <p className="page-description">
            Update listing details, manage mock photos, deactivate a listing, or
            delete a listing. This page uses frontend-only mock behavior for the
            R1 demo.
          </p>
        </div>

        <Link className="secondary-link header-action-link" to={`/tools/${tool.id}`}>
          Back to Tool Detail
        </Link>
      </div>

      {/* Listing status banner for US10. */}
      <section className={`listing-state-banner listing-state-${listingState.toLowerCase()}`}>
        <strong>Mock Listing Status:</strong> {listingState}
        {listingState === 'DEACTIVATED' && (
          <span> — This listing is hidden from borrowers in the mock demo.</span>
        )}
        {listingState === 'DELETED' && (
          <span> — This listing is treated as removed in the mock demo.</span>
        )}
      </section>

      {/* Owner-only warning for US10. */}
      {!isCurrentUserOwner && (
        <section className="warning-panel">
          <strong>Owner-only action:</strong> Current mock user is Yafei Wang.
          This tool belongs to {tool.ownerName}, so delete/deactivate actions are
          blocked in the frontend demo.
        </section>
      )}

      {/* Demo warning for blocked edit state. */}
      {isEditBlockedBecausePickedUp && (
        <section className="warning-panel">
          <strong>Edit blocked for demo:</strong> This mock listing represents a tool
          that is currently PICKED_UP. Editing is blocked while a tool is out on loan.
        </section>
      )}

      <section className="tool-form-layout">
        {/* Edit form. noValidate allows React validation messages to show. */}
        <form className="tool-form-card" onSubmit={handleSubmit} noValidate>
          <h2>Listing Information</h2>

          {/* Task 5B: HST helper text for owner-side listing schedule fields. */}
          <section className="hst-helper-panel tool-form-hst-helper">
            <strong>HST listing schedule</strong>
            <p>
              Availability dates and latest return time are interpreted in
              Hawaii Standard Time (HST). Backend validation can later normalize
              these values before saving to the database.
            </p>
          </section>

          <div className="form-grid">
            {/* Required tool name field. */}
            <label htmlFor="edit-tool-name">
              Tool Name *
              <input
                id="edit-tool-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Example: Cordless Drill"
                disabled={isEditFormDisabled}
              />
            </label>

            {/* Required category field. */}
            <label htmlFor="edit-tool-category">
              Category *
              <select
                id="edit-tool-category"
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as ToolCategory | '')
                }
                disabled={isEditFormDisabled}
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
            <label htmlFor="edit-tool-condition">
              Condition *
              <select
                id="edit-tool-condition"
                value={condition}
                onChange={(event) =>
                  setCondition(event.target.value as ToolCondition | '')
                }
                disabled={isEditFormDisabled}
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
            <label htmlFor="edit-tool-return-time">
              Latest Return Time (HST) *
              <input
                id="edit-tool-return-time"
                type="time"
                value={latestReturnTime}
                onChange={(event) => setLatestReturnTime(event.target.value)}
                disabled={isEditFormDisabled}
              />
            </label>

            {/* Required availability start date. */}
            <label htmlFor="edit-tool-available-from">
              Available From Date (HST) *
              <input
                id="edit-tool-available-from"
                type="date"
                value={availableFrom}
                onChange={(event) => setAvailableFrom(event.target.value)}
                disabled={isEditFormDisabled}
              />
            </label>

            {/* Required availability end date. */}
            <label htmlFor="edit-tool-available-to">
              Available To Date (HST) *
              <input
                id="edit-tool-available-to"
                type="date"
                value={availableTo}
                onChange={(event) => setAvailableTo(event.target.value)}
                disabled={isEditFormDisabled}
              />
            </label>
          </div>

          <p className="hst-note">
            Availability dates and latest return time are interpreted in Hawaii
            Standard Time (HST). Latest return time must use HH:MM 24-hour HST
            format, for example 17:30.
          </p>

          {/* Required description field. */}
          <label htmlFor="edit-tool-description">
            Description *
            <textarea
              id="edit-tool-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              placeholder="Describe the tool and what it is useful for."
              disabled={isEditFormDisabled}
            />
          </label>

          {/* Optional notes field. */}
          <label htmlFor="edit-tool-notes">
            Notes for Borrowers
            <textarea
              id="edit-tool-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Example: Please return with battery charged."
              disabled={isEditFormDisabled}
            />
          </label>

          {/* Photo management section. */}
          <div className="photo-management-section">
            <h3>Mock Photo Management</h3>
            <p className="helper-text">
              For now, this demo supports both photo URLs and local photo file previews.
              The first photo is treated as the thumbnail.
            </p>

            {/* Add photo by URL. */}
            <div className="photo-add-row">
              <input
                value={newPhotoUrl}
                onChange={(event) => setNewPhotoUrl(event.target.value)}
                placeholder="Paste photo URL"
                disabled={isEditFormDisabled}
              />

              <button
                type="button"
                className="secondary-button"
                onClick={handleAddPhotoUrl}
                disabled={isEditFormDisabled}
              >
                Add Photo URL
              </button>
            </div>

            {/* Add photo by local upload. */}
            <label htmlFor="edit-tool-photo-upload">
              Upload Photo
              <input
                id="edit-tool-photo-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoUpload}
                disabled={isEditFormDisabled}
              />
            </label>

            <p className="auth-helper-text">
              Accepted photo types: JPG, PNG, or WebP. Maximum size: 5 MB each.
            </p>

            {/* Current photo list. */}
            <div className="photo-list">
              {photoUrls.map((photoUrl, index) => (
                <article className="photo-list-item" key={`${photoUrl}-${index}`}>
                  <img src={photoUrl} alt={`${name} photo ${index + 1}`} />

                  <div>
                    <strong>
                      Photo {index + 1}
                      {index === 0 ? ' - Thumbnail' : ''}
                    </strong>
                    <p>{photoUrl}</p>

                    <div className="photo-action-row">
                      <button
                        type="button"
                        className="secondary-button small-button"
                        onClick={() => handleMovePhoto(index, 'up')}
                        disabled={index === 0 || isEditFormDisabled}
                      >
                        Move Up
                      </button>

                      <button
                        type="button"
                        className="secondary-button small-button"
                        onClick={() => handleMovePhoto(index, 'down')}
                        disabled={
                          index === photoUrls.length - 1 || isEditFormDisabled
                        }
                      >
                        Move Down
                      </button>

                      <button
                        type="button"
                        className="danger-button small-button"
                        onClick={() => handleRemovePhoto(index)}
                        disabled={isEditFormDisabled}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* Validation and success messages. */}
          {errorMessage && <p className="form-error">{errorMessage}</p>}
          {successMessage && <p className="success-message">{successMessage}</p>}

          {/* Submit button. */}
          <button
            className="primary-button"
            type="submit"
            disabled={isEditFormDisabled}
          >
            Save Mock Changes
          </button>
        </form>

        {/* Right side: preview + US10 delete/deactivate controls. */}
        <aside className="tool-preview-card">
          <h2>Live Preview</h2>

          <img
            className="tool-preview-image"
            src={photoUrls[0] || 'https://placehold.co/600x400?text=Tool'}
            alt={`${name || 'Tool'} preview`}
          />

          <h3>{name || 'Tool Name'}</h3>

          <p>
            <strong>Category:</strong>{' '}
            {category ? categoryLabels[category] : 'Not selected'}
          </p>

          <p>
            <strong>Condition:</strong> {condition || 'Not selected'}
          </p>

          <p>
            <strong>Available (HST):</strong>{' '}
            {availableFrom ? `${availableFrom} HST` : 'Not selected'} to{' '}
            {availableTo ? `${availableTo} HST` : 'Not selected'}
          </p>

          <p>
            <strong>Latest Return Time (HST):</strong>{' '}
            {latestReturnTime || '--:--'}
          </p>

          <p>
            <strong>Description:</strong>{' '}
            {description || 'Description will appear here.'}
          </p>

          <p>
            <strong>Borrower Notes:</strong> {notes || 'No notes provided.'}
          </p>

          <p className="workflow-note">
            This preview updates locally only. Backend save will be connected later.
          </p>

          {/* US10 Delete / Deactivate Tool Listing UI. */}
          <section className="tool-danger-zone">
            <p className="eyebrow">US10 Delete / Deactivate</p>
            <h2>Listing Controls</h2>

            <p>
              Use this section to demo owner-side deactivate/delete behavior.
              Active reservations block both actions.
            </p>

            {/* Active reservation block message for US10. */}
            {activeReservationsForTool.length > 0 && (
              <div className="active-reservation-block">
                <strong>Active reservation block</strong>
                <p>
                  This tool has active reservations. Delete/deactivate should be
                  blocked until the reservations are completed or cancelled.
                </p>

                <ul className="active-reservation-list">
                  {activeReservationsForTool.map((reservation) => (
                    <li key={reservation.id}>
                      <strong>
                        {reservation.toolName} — {reservation.status}
                      </strong>
                      <span>
                        {reservation.startDate} to {reservation.endDate}
                      </span>
                      <span>Borrower: {reservation.borrowerName}</span>
                    </li>
                  ))}
                </ul>

                {/* Demo override so the success path can be tested without backend. */}
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={pretendReservationsResolved}
                    onChange={(event) =>
                      setPretendReservationsResolved(event.target.checked)
                    }
                    disabled={isListingDeleted}
                  />
                  Demo only: pretend active reservations are resolved
                </label>
              </div>
            )}

            {/* Deactivate form for US10. */}
            <form
              className="deactivate-listing-form"
              onSubmit={handleDeactivateListing}
              noValidate
            >
              <label htmlFor="deactivation-reason">
                Deactivation Reason *
                <textarea
                  id="deactivation-reason"
                  value={deactivationReason}
                  onChange={(event) => setDeactivationReason(event.target.value)}
                  rows={3}
                  placeholder="Example: Tool needs repair before it can be borrowed again."
                  disabled={!isCurrentUserOwner || isListingDeleted}
                />
              </label>

              <button
                type="submit"
                className="danger-action-button"
                disabled={!isCurrentUserOwner || isListingDeleted}
              >
                Deactivate Listing
              </button>
            </form>

            {/* Reactivate button is demo-only helper after deactivation. */}
            {listingState === 'DEACTIVATED' && (
              <button
                type="button"
                className="secondary-button"
                onClick={handleReactivateListing}
              >
                Reactivate Mock Listing
              </button>
            )}

            {/* Delete confirmation for US10. */}
            <div className="delete-listing-box">
              <label htmlFor="delete-confirmation">
                Type DELETE to confirm deletion
                <input
                  id="delete-confirmation"
                  value={deleteConfirmationText}
                  onChange={(event) =>
                    setDeleteConfirmationText(event.target.value)
                  }
                  placeholder="DELETE"
                  disabled={!isCurrentUserOwner || isListingDeleted}
                />
              </label>

              <button
                type="button"
                className="danger-action-button"
                onClick={handleDeleteListing}
                disabled={!isCurrentUserOwner || isListingDeleted}
              >
                Delete Listing
              </button>
            </div>

            <p className="demo-note">
              Demo note: delete/deactivate changes only this page state. The real
              backend will later save listing status changes permanently.
            </p>
          </section>
        </aside>
      </section>
    </section>
  );
}

export default EditToolPage;
