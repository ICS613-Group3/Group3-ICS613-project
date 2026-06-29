import { useMemo, useState, type FormEvent  } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  categoryLabels,
  mockTools,
  type ToolCategory,
  type ToolCondition,
} from '../data/mockData';

/**
 * EditToolPage
 *
 * This page supports US9 � Edit a Tool Listing and Manage Photos.
 *
 * Current R1 behavior:
 * - Uses mockTools data from src/data/mockData.ts.
 * - Pre-fills the form with the selected tool's current information.
 * - Validates required fields before showing a mock success message.
 * - Allows mock photo URL add/remove/reorder behavior.
 *
 * Important:
 * - This is frontend-only mock behavior.
 * - It does NOT save to the backend yet.
 * - Ivan can later connect handleSubmit() to the backend PATCH /tools/:id API.
 */
function EditToolPage() {
  const { toolId } = useParams();

  /**
   * Find the selected tool from mock data.
   * Example route:
   * /tools/tool-1/edit
   */
  const tool = useMemo(
    () => mockTools.find((currentTool) => currentTool.id === toolId),
    [toolId],
  );

  /**
   * If the URL has a bad toolId, show a clear error page.
   * This prevents the form from crashing when tool is undefined.
   */
  if (!tool) {
    return (
      <main className="page-container">
        <section className="tool-form-card">
          <p className="eyebrow">Edit Tool</p>
          <h1>Tool not found</h1>
          <p className="page-subtitle">
            The tool you are trying to edit does not exist in the mock data.
          </p>

          <Link className="secondary-link" to="/tools">
            Back to Browse Tools
          </Link>
        </section>
      </main>
    );
  }

  /**
   * R1 mock rule:
   * We simulate the US9 rule that editing should be blocked when a tool is PICKED_UP.
   *
   * Since this page is still mock-only, we use tool-3 as a demo blocked listing.
   * This lets you show the instructor that the UI understands the PICKED_UP restriction.
   *
   * Later, backend API should return the real editable/not-editable status.
   */
  const isEditBlockedBecausePickedUp = tool.id === 'tool-3';

  /**
   * Form state starts with the existing tool values.
   * This makes the edit page feel like a real edit workflow.
   */
  const [name, setName] = useState(tool.name);
  const [category, setCategory] = useState<ToolCategory>(tool.category);
  const [condition, setCondition] = useState<ToolCondition>(tool.condition);
  const [latestReturnTime, setLatestReturnTime] = useState(tool.latestReturnTime);
  const [availableFrom, setAvailableFrom] = useState(tool.availableFrom);
  const [availableTo, setAvailableTo] = useState(tool.availableTo);
  const [description, setDescription] = useState(tool.description);
  const [notes, setNotes] = useState(tool.notesForBorrowers);

  /**
   * Mock photo management.
   *
   * The current mock data uses one main image per tool.
   * For the R1 demo, this array allows us to demonstrate:
   * - keeping at least 1 photo
   * - adding a photo URL
   * - removing a photo
   * - moving photos up/down
   */
  const [photoUrls, setPhotoUrls] = useState<string[]>([tool.imageUrl]);
  const [newPhotoUrl, setNewPhotoUrl] = useState('');

  /**
   * UI feedback messages.
   */
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  /**
   * Dropdown options.
   * These category values match the backend-aligned enum values already fixed earlier.
   */
  const categoryOptions = Object.entries(categoryLabels) as [ToolCategory, string][];

  const conditionOptions: ToolCondition[] = [
    'New',
    'Like New',
    'Good',
    'Fair',
    'Poor',
  ];

  /**
   * Adds one mock photo URL.
   * US9 requires photo add/remove behavior, with a maximum of 5 photos.
   */
  const handleAddPhoto = () => {
    setErrorMessage('');
    setSuccessMessage('');

    const trimmedPhotoUrl = newPhotoUrl.trim();

    if (!trimmedPhotoUrl) {
      setErrorMessage('Please enter a photo URL before adding.');
      return;
    }

    if (photoUrls.length >= 5) {
      setErrorMessage('A tool listing can have a maximum of 5 photos.');
      return;
    }

    setPhotoUrls([...photoUrls, trimmedPhotoUrl]);
    setNewPhotoUrl('');
  };

  /**
   * Removes one mock photo.
   * US9 requires at least 1 photo to remain.
   */
  const handleRemovePhoto = (photoIndex: number) => {
    setErrorMessage('');
    setSuccessMessage('');

    if (photoUrls.length <= 1) {
      setErrorMessage('At least 1 photo is required for the listing.');
      return;
    }

    setPhotoUrls(photoUrls.filter((_, index) => index !== photoIndex));
  };

  /**
   * Moves a photo up or down in the mock photo list.
   * The first photo acts as the thumbnail.
   */
  const handleMovePhoto = (photoIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? photoIndex - 1 : photoIndex + 1;

    if (targetIndex < 0 || targetIndex >= photoUrls.length) {
      return;
    }

    const updatedPhotos = [...photoUrls];
    const currentPhoto = updatedPhotos[photoIndex];

    updatedPhotos[photoIndex] = updatedPhotos[targetIndex];
    updatedPhotos[targetIndex] = currentPhoto;

    setPhotoUrls(updatedPhotos);
  };

  /**
   * Mock save handler.
   *
   * Later backend integration idea:
   * Replace the success message with a PATCH request, for example:
   * await toolService.updateTool(tool.id, formData)
   */
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setErrorMessage('');
    setSuccessMessage('');

    if (isEditBlockedBecausePickedUp) {
      setErrorMessage(
        'This listing cannot be edited while the tool is currently PICKED_UP.',
      );
      return;
    }

    if (!name.trim()) {
      setErrorMessage('Tool name is required.');
      return;
    }

    if (!description.trim()) {
      setErrorMessage('Description is required.');
      return;
    }

    if (!condition) {
      setErrorMessage('Condition is required.');
      return;
    }

    if (!category) {
      setErrorMessage('Category is required.');
      return;
    }

    if (!latestReturnTime) {
      setErrorMessage('Latest return time is required.');
      return;
    }

    if (!availableFrom || !availableTo) {
      setErrorMessage('Available From and Available To dates are required.');
      return;
    }

    if (availableTo < availableFrom) {
      setErrorMessage('Available To date cannot be before Available From date.');
      return;
    }

    if (photoUrls.length < 1) {
      setErrorMessage('At least 1 photo is required.');
      return;
    }

    setSuccessMessage(
      `Mock update saved for ${name}. This is frontend-only and not saved to the backend yet.`,
    );
  };

  return (
    <main className="page-container">
      <section className="page-header split-page-header">
        <div>
          <p className="eyebrow">US9 Edit Tool Listing</p>
          <h1>Edit Tool Listing</h1>
          <p className="page-subtitle">
            Update listing details, availability, return time, notes, and mock photos.
          </p>
        </div>

        <div className="header-actions">
          <Link className="secondary-link" to={`/tools/${tool.id}`}>
            Back to Tool Detail
          </Link>
        </div>
      </section>

      {isEditBlockedBecausePickedUp && (
        <section className="warning-panel">
          <strong>Edit blocked for demo:</strong> This mock listing represents a tool
          that is currently PICKED_UP. US9 says editing should be blocked while a tool
          is out on loan.
        </section>
      )}

      <section className="tool-form-layout">
        <form className="tool-form-card" onSubmit={handleSubmit}>
          <h2>Listing Information</h2>

          <div className="form-grid">
            <label>
              Tool Name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Example: Cordless Drill"
                disabled={isEditBlockedBecausePickedUp}
              />
            </label>

            <label>
              Category
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as ToolCategory)}
                disabled={isEditBlockedBecausePickedUp}
              >
                {categoryOptions.map(([categoryValue, label]) => (
                  <option key={categoryValue} value={categoryValue}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Condition
              <select
                value={condition}
                onChange={(event) => setCondition(event.target.value as ToolCondition)}
                disabled={isEditBlockedBecausePickedUp}
              >
                {conditionOptions.map((conditionValue) => (
                  <option key={conditionValue} value={conditionValue}>
                    {conditionValue}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Latest Return Time
              <input
                type="time"
                value={latestReturnTime}
                onChange={(event) => setLatestReturnTime(event.target.value)}
                disabled={isEditBlockedBecausePickedUp}
              />
            </label>

            <label>
              Available From
              <input
                type="date"
                value={availableFrom}
                onChange={(event) => setAvailableFrom(event.target.value)}
                disabled={isEditBlockedBecausePickedUp}
              />
            </label>

            <label>
              Available To
              <input
                type="date"
                value={availableTo}
                onChange={(event) => setAvailableTo(event.target.value)}
                disabled={isEditBlockedBecausePickedUp}
              />
            </label>
          </div>

          <label>
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              placeholder="Describe the tool and what it is useful for."
              disabled={isEditBlockedBecausePickedUp}
            />
          </label>

          <label>
            Notes for Borrowers
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Example: Please return with battery charged."
              disabled={isEditBlockedBecausePickedUp}
            />
          </label>

          <div className="photo-management-section">
            <h3>Mock Photo Management</h3>
            <p className="helper-text">
              US9 requires photo management. For now, this demo uses photo URLs instead
              of real file upload. The first photo is treated as the thumbnail.
            </p>

            <div className="photo-add-row">
              <input
                value={newPhotoUrl}
                onChange={(event) => setNewPhotoUrl(event.target.value)}
                placeholder="Paste photo URL"
                disabled={isEditBlockedBecausePickedUp}
              />

              <button
                type="button"
                className="secondary-button"
                onClick={handleAddPhoto}
                disabled={isEditBlockedBecausePickedUp}
              >
                Add Photo
              </button>
            </div>

            <div className="photo-list">
              {photoUrls.map((photoUrl, index) => (
                <article className="photo-list-item" key={`${photoUrl}-${index}`}>
                  <img src={photoUrl} alt={`${name} photo ${index + 1}`} />

                  <div>
                    <strong>
                      Photo {index + 1}
                      {index === 0 ? ' � Thumbnail' : ''}
                    </strong>
                    <p>{photoUrl}</p>

                    <div className="photo-action-row">
                      <button
                        type="button"
                        className="secondary-button small-button"
                        onClick={() => handleMovePhoto(index, 'up')}
                        disabled={index === 0 || isEditBlockedBecausePickedUp}
                      >
                        Move Up
                      </button>

                      <button
                        type="button"
                        className="secondary-button small-button"
                        onClick={() => handleMovePhoto(index, 'down')}
                        disabled={
                          index === photoUrls.length - 1 ||
                          isEditBlockedBecausePickedUp
                        }
                      >
                        Move Down
                      </button>

                      <button
                        type="button"
                        className="danger-button small-button"
                        onClick={() => handleRemovePhoto(index)}
                        disabled={isEditBlockedBecausePickedUp}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {errorMessage && <p className="error-message">{errorMessage}</p>}
          {successMessage && <p className="success-message">{successMessage}</p>}

          <button
            className="primary-button"
            type="submit"
            disabled={isEditBlockedBecausePickedUp}
          >
            Save Mock Changes
          </button>
        </form>

        <aside className="tool-preview-card">
          <h2>Live Preview</h2>

          <img
            className="tool-preview-image"
            src={photoUrls[0]}
            alt={`${name} preview`}
          />

          <h3>{name || 'Tool Name'}</h3>

          <p>
            <strong>Category:</strong> {categoryLabels[category]}
          </p>

          <p>
            <strong>Condition:</strong> {condition}
          </p>

          <p>
            <strong>Available:</strong> {availableFrom} to {availableTo}
          </p>

          <p>
            <strong>Latest Return Time:</strong> {latestReturnTime} HST
          </p>

          <p>
            <strong>Description:</strong> {description}
          </p>

          <p>
            <strong>Borrower Notes:</strong> {notes || 'No notes provided.'}
          </p>

          <p className="workflow-note">
            This preview updates locally only. Backend save will be connected later.
          </p>
        </aside>
      </section>
    </main>
  );
}

export default EditToolPage;
