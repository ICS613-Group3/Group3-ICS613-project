import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ApiRequestError } from '../api/client';
import { reservationsApi } from '../api/reservations';
import { toolsApi } from '../api/tools';
import { useAuth } from '../context/useAuth';
import { useCategories } from '../hooks/useCategories';
import type {
  PhotoOut,
  ToolCategory,
  ToolCondition,
  ToolResponse,
} from '../types/api';

const conditionOptions: ToolCondition[] = [
  'NEW',
  'LIKE_NEW',
  'GOOD',
  'FAIR',
  'POOR',
];

const maxPhotoCount = 5;
const maxPhotoSizeBytes = 5 * 1024 * 1024;
const allowedPhotoTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

function sortPhotos(photos: PhotoOut[]): PhotoOut[] {
  return [...photos].sort(
    (first, second) =>
      first.display_order - second.display_order,
  );
}

function EditToolPage() {
  const { toolId } = useParams();
  const { user } = useAuth();
  const { categoryOptions } = useCategories();

  const [tool, setTool] = useState<ToolResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [name, setName] = useState('');
  const [category, setCategory] =
    useState<ToolCategory | ''>('');
  const [condition, setCondition] =
    useState<ToolCondition | ''>('');
  const [description, setDescription] = useState('');

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhotos, setIsUploadingPhotos] =
    useState(false);
  const [removingPhotoId, setRemovingPhotoId] =
    useState<string | null>(null);

  const [hasPickedUpReservation, setHasPickedUpReservation] =
    useState(false);
  const [isCheckingLoanStatus, setIsCheckingLoanStatus] =
    useState(false);
  const [loanStatusError, setLoanStatusError] = useState('');

  const [deactivationReason, setDeactivationReason] =
    useState('');
  const [isDeactivating, setIsDeactivating] =
    useState(false);
  const [isReactivating, setIsReactivating] =
    useState(false);

  const loadTool = useCallback(async () => {
    if (!toolId) {
      return;
    }

    setIsLoading(true);
    setLoadError('');
    setLoanStatusError('');
    setHasPickedUpReservation(false);

    try {
      const loadedTool = await toolsApi.get(toolId);

      setTool(loadedTool);
      setName(loadedTool.name);
      setCategory(loadedTool.category);
      setCondition(loadedTool.condition);
      setDescription(loadedTool.description || '');

      if (user?.id === loadedTool.owner_id) {
        setIsCheckingLoanStatus(true);

        try {
          const pickedUpReservations =
            await reservationsApi.list({
              role: 'owner',
              state: 'PICKED_UP',
              page_size: 100,
            });

          setHasPickedUpReservation(
            pickedUpReservations.items.some(
              (reservation) =>
                reservation.tool_id === loadedTool.id,
            ),
          );
        } catch {
          setLoanStatusError(
            'Unable to verify whether this tool is currently out on loan. ' +
              'Editing and photo changes are temporarily disabled.',
          );
        } finally {
          setIsCheckingLoanStatus(false);
        }
      }
    } catch (error) {
      setLoadError(
        error instanceof ApiRequestError
          ? error.detail
          : 'Tool not found.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [toolId, user]);

  useEffect(() => {
    loadTool();
  }, [loadTool]);

  const isOwner =
    Boolean(user && tool && user.id === tool.owner_id);

  const isAdmin = user?.is_admin === true;

  const editBlocked =
    hasPickedUpReservation ||
    isCheckingLoanStatus ||
    Boolean(loanStatusError);

  const orderedPhotos = tool
    ? sortPhotos(tool.photos)
    : [];

  const showBlockedMessage = () => {
    if (hasPickedUpReservation) {
      setErrorMessage(
        'This listing cannot be edited while the tool is out on loan.',
      );
      return;
    }

    if (loanStatusError || isCheckingLoanStatus) {
      setErrorMessage(
        loanStatusError ||
          'The current loan status is still being checked.',
      );
    }
  };

  const handleSave = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (editBlocked) {
      showBlockedMessage();
      return;
    }

    if (!name.trim()) {
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

    if (!description.trim()) {
      setErrorMessage('Description is required.');
      return;
    }

    setIsSaving(true);

    try {
      const updated = await toolsApi.update(toolId!, {
        name: name.trim(),
        description: description.trim(),
        category,
        condition,
      });

      setTool(updated);
      setSuccessMessage(
        'Tool listing updated successfully.',
      );
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        error.status === 409 &&
        error.detail.toUpperCase().includes('PICKED_UP')
      ) {
        setErrorMessage(
          'This listing cannot be edited while the tool is out on loan.',
        );
      } else {
        setErrorMessage(
          error instanceof ApiRequestError
            ? error.detail
            : 'Failed to update the tool listing.',
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    setErrorMessage('');
    setSuccessMessage('');

    const files = Array.from(event.target.files || []);
    event.target.value = '';

    if (!tool || files.length === 0) {
      return;
    }

    if (editBlocked) {
      showBlockedMessage();
      return;
    }

    if (tool.photos.length + files.length > maxPhotoCount) {
      setErrorMessage(
        `A maximum of ${maxPhotoCount} photos is allowed. ` +
          `This listing currently has ${tool.photos.length}.`,
      );
      return;
    }

    const invalidType = files.find(
      (file) => !allowedPhotoTypes.includes(file.type),
    );

    if (invalidType) {
      setErrorMessage(
        `${invalidType.name} is not a supported image. ` +
          'Photos must be JPG, PNG, or WebP.',
      );
      return;
    }

    const oversizedFile = files.find(
      (file) => file.size > maxPhotoSizeBytes,
    );

    if (oversizedFile) {
      setErrorMessage(
        `${oversizedFile.name} is larger than 5 MB. ` +
          'Each photo must be 5 MB or smaller.',
      );
      return;
    }

    const formData = new FormData();

    for (const file of files) {
      formData.append('photos', file);
    }

    setIsUploadingPhotos(true);

    try {
      const updated = await toolsApi.addPhotos(
        tool.id,
        formData,
      );

      setTool(updated);
      setSuccessMessage(
        files.length === 1
          ? 'Photo added successfully.'
          : `${files.length} photos added successfully.`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof ApiRequestError
          ? error.detail
          : 'Failed to add the selected photos.',
      );
    } finally {
      setIsUploadingPhotos(false);
    }
  };

  const handleRemovePhoto = async (photoId: string) => {
    if (!tool) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');

    if (editBlocked) {
      showBlockedMessage();
      return;
    }

    if (orderedPhotos.length <= 1) {
      setErrorMessage(
        'At least one photo is required for the listing.',
      );
      return;
    }

    setRemovingPhotoId(photoId);

    try {
      await toolsApi.removePhoto(tool.id, photoId);

      const refreshedTool = await toolsApi.get(tool.id);
      setTool(refreshedTool);

      setSuccessMessage(
        'Photo removed successfully. The first remaining photo is now the thumbnail.',
      );
    } catch (error) {
      setErrorMessage(
        error instanceof ApiRequestError
          ? error.detail
          : 'Failed to remove the photo.',
      );
    } finally {
      setRemovingPhotoId(null);
    }
  };

  const handleDeactivate = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!deactivationReason.trim()) {
      setErrorMessage('A deactivation reason is required.');
      return;
    }

    setIsDeactivating(true);

    try {
      const updated = await toolsApi.deactivate(toolId!, {
        reason: deactivationReason.trim(),
      });

      setTool(updated);
      setSuccessMessage(
        'Tool deactivated successfully.',
      );
    } catch (error) {
      setErrorMessage(
        error instanceof ApiRequestError
          ? error.detail
          : 'Failed to deactivate the listing.',
      );
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleReactivate = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    setIsReactivating(true);

    try {
      const updated = await toolsApi.reactivate(toolId!);
      setTool(updated);
      setSuccessMessage(
        'Tool reactivated successfully.',
      );
    } catch (error) {
      setErrorMessage(
        error instanceof ApiRequestError
          ? error.detail
          : 'Failed to reactivate the listing.',
      );
    } finally {
      setIsReactivating(false);
    }
  };

  if (isLoading) {
    return (
      <section className="page-section">
        <div className="page-header">
          <h1>Loading...</h1>
        </div>
      </section>
    );
  }

  if (!tool || loadError) {
    return (
      <section className="page-section">
        <div className="tool-form-card">
          <p className="eyebrow">Edit Tool</p>
          <h1>Tool not found</h1>
          <p className="page-description">
            {loadError || 'The tool does not exist.'}
          </p>
          <Link className="secondary-link" to="/tools">
            Back to Browse Tools
          </Link>
        </div>
      </section>
    );
  }

  if (!isOwner) {
    return (
      <section className="page-section">
        <div className="tool-form-card">
          <p className="eyebrow">Edit Tool</p>
          <h1>Access Denied</h1>
          <p className="page-description">
            Only the tool owner can edit this listing.
          </p>
          <Link
            className="secondary-link"
            to={`/tools/${tool.id}`}
          >
            Back to Tool Detail
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Edit Tool</p>
          <h1>Edit: {tool.name}</h1>
        </div>

        <Link
          className="secondary-link"
          to={`/tools/${tool.id}`}
        >
          Back to Tool Detail
        </Link>
      </div>

      {hasPickedUpReservation && (
        <div className="empty-state-card">
          <h2>Editing temporarily unavailable</h2>
          <p>
            This tool is currently out on loan. Listing fields and
            photos cannot be changed until the reservation is marked
            RETURNED.
          </p>
        </div>
      )}

      {loanStatusError && (
        <p className="form-error">{loanStatusError}</p>
      )}

      {errorMessage && (
        <p className="form-error">{errorMessage}</p>
      )}

      {successMessage && (
        <p className="form-success">{successMessage}</p>
      )}

      <div className="tool-form-layout">
        <form
          className="tool-form-card"
          onSubmit={handleSave}
          noValidate
        >
          <p className="eyebrow">US9 Edit Tool</p>
          <h2>Edit Listing</h2>

          <div className="form-grid">
            <label htmlFor="edit-tool-name">
              Tool Name *
              <input
                id="edit-tool-name"
                type="text"
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                disabled={editBlocked || isSaving}
              />
            </label>

            <label htmlFor="edit-tool-category">
              Category *
              <select
                id="edit-tool-category"
                value={category}
                onChange={(event) =>
                  setCategory(
                    event.target.value as ToolCategory | '',
                  )
                }
                disabled={editBlocked || isSaving}
              >
                <option value="">Select category</option>
                {categoryOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label htmlFor="edit-tool-condition">
              Condition *
              <select
                id="edit-tool-condition"
                value={condition}
                onChange={(event) =>
                  setCondition(
                    event.target.value as
                      | ToolCondition
                      | '',
                  )
                }
                disabled={editBlocked || isSaving}
              >
                <option value="">Select condition</option>
                {conditionOptions.map((value) => (
                  <option key={value} value={value}>
                    {value.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label htmlFor="edit-tool-description">
            Description *
            <textarea
              id="edit-tool-description"
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              rows={4}
              disabled={editBlocked || isSaving}
            />
          </label>

          <div>
            <p className="eyebrow">Listing Photos</p>
            <h2>
              Manage Photos ({orderedPhotos.length}/
              {maxPhotoCount})
            </h2>

            <label htmlFor="edit-tool-photos">
              Add Photos
              <input
                id="edit-tool-photos"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handlePhotoUpload}
                disabled={
                  editBlocked ||
                  isUploadingPhotos ||
                  !tool.is_active ||
                  orderedPhotos.length >= maxPhotoCount
                }
              />
            </label>

            <p className="auth-helper-text">
              Accepted: JPG, PNG, or WebP. Maximum 5 MB each.
              The first photo is used as the listing thumbnail.
            </p>

            {orderedPhotos.length >= maxPhotoCount && (
              <p className="helper-text">
                This listing already has the maximum of five
                photos.
              </p>
            )}

            <div className="photo-list">
              {orderedPhotos.map((photo, index) => (
                <article
                  className="photo-list-item"
                  key={photo.id}
                >
                  <img
                    src={photo.url}
                    alt={`${tool.name} photo ${index + 1}`}
                  />

                  <div>
                    <strong>
                      Photo {index + 1}
                      {index === 0 ? ' — Thumbnail' : ''}
                    </strong>

                    <button
                      type="button"
                      className="secondary-button small-button"
                      onClick={() =>
                        handleRemovePhoto(photo.id)
                      }
                      disabled={
                        editBlocked ||
                        orderedPhotos.length <= 1 ||
                        removingPhotoId === photo.id
                      }
                    >
                      {removingPhotoId === photo.id
                        ? 'Removing...'
                        : 'Remove'}
                    </button>

                    {orderedPhotos.length <= 1 && (
                      <p className="helper-text">
                        At least one photo must remain.
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <p>
            <strong>Status:</strong>{' '}
            {tool.is_active ? 'Active' : 'Deactivated'}
            {tool.deactivation_reason && (
              <> — Reason: {tool.deactivation_reason}</>
            )}
          </p>

          <button
            className="primary-button"
            type="submit"
            disabled={
              isSaving ||
              editBlocked ||
              !tool.is_active
            }
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>

        <aside className="tool-preview-card">
          <p className="eyebrow">
            US10 Listing Lifecycle
          </p>
          <h2>Deactivate / Reactivate</h2>

          {tool.is_active ? (
            <div>
              <p>
                Deactivate this listing to temporarily remove it
                from browse results. Existing REQUESTED and
                APPROVED reservations will be auto-cancelled.
              </p>

              <label htmlFor="deactivation-reason">
                Reason *
                <input
                  id="deactivation-reason"
                  type="text"
                  value={deactivationReason}
                  onChange={(event) =>
                    setDeactivationReason(event.target.value)
                  }
                  placeholder="Why are you deactivating this listing?"
                />
              </label>

              <button
                className="action-button danger-button"
                type="button"
                onClick={handleDeactivate}
                disabled={isDeactivating}
              >
                {isDeactivating
                  ? 'Deactivating...'
                  : 'Deactivate Listing'}
              </button>
            </div>
          ) : isAdmin ? (
            <div>
              <p>
                This listing is currently deactivated.
                Reactivate it to make it available again.
              </p>

              <button
                className="action-button approve-button"
                type="button"
                onClick={handleReactivate}
                disabled={isReactivating}
              >
                {isReactivating
                  ? 'Reactivating...'
                  : 'Reactivate Listing'}
              </button>
            </div>
          ) : (
            <div>
              <p>
                This listing is currently deactivated. Only an
                admin can reactivate it.
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

export default EditToolPage;
