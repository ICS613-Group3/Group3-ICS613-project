import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  absolutePhotoUrl,
  ApiError,
  toolsApi,
  type Tool,
  type ToolCategory,
  type ToolCondition,
} from '../api/client';
import { useAuth } from '../context/authContextValue';

const categoryLabels: Record<ToolCategory, string> = {
  HAND_TOOLS: 'Hand Tools',
  POWER_TOOLS: 'Power Tools',
  GARDEN_TOOLS: 'Garden Tools',
  CLEANING_TOOLS: 'Cleaning Tools',
  OUTDOOR_GEAR: 'Outdoor Gear',
};

const conditionLabels: Record<ToolCondition, string> = {
  NEW: 'New',
  LIKE_NEW: 'Like New',
  GOOD: 'Good',
  FAIR: 'Fair',
  POOR: 'Poor',
};

const categoryOptions: ToolCategory[] = [
  'HAND_TOOLS',
  'POWER_TOOLS',
  'GARDEN_TOOLS',
  'CLEANING_TOOLS',
  'OUTDOOR_GEAR',
];

const conditionOptions: ToolCondition[] = [
  'NEW',
  'LIKE_NEW',
  'GOOD',
  'FAIR',
  'POOR',
];

/**
 * EditToolPage
 *
 * Real backend edit via ``PATCH /tools/{id}`` plus the separate
 * photo endpoints:
 *   - ``POST   /tools/{id}/photos``    — add 1–5 photos
 *   - ``DELETE /tools/{id}/photos/{photoId}`` — remove one
 *
 * Backend constraints:
 * - PATCH is blocked (409) when any reservation is in ``PICKED_UP`` state.
 * - Photo add enforces a 1–5 total per tool.
 * - Cannot remove the last photo (422).
 */
function EditToolPage() {
  const { toolId } = useParams();
  const { user } = useAuth();

  const [tool, setTool] = useState<Tool | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [name, setName] = useState('');
  const [category, setCategory] = useState<ToolCategory>('GOOD' as never);
  const [condition, setCondition] = useState<ToolCondition>('GOOD' as never);
  const [description, setDescription] = useState('');

  const [newPhotoFiles, setNewPhotoFiles] = useState<File[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddingPhotos, setIsAddingPhotos] = useState(false);

  useEffect(() => {
    if (!toolId) return;
    let cancelled = false;
    setIsLoading(true);
    setLoadError('');
    toolsApi
      .get(toolId)
      .then((t) => {
        if (cancelled) return;
        setTool(t);
        setName(t.name);
        setCategory(t.category);
        setCondition(t.condition);
        setDescription(t.description ?? '');
      })
      .catch((err) => {
        if (!cancelled) {
          if (err instanceof ApiError) setLoadError(err.message);
          else setLoadError('Failed to load tool.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toolId]);

  if (isLoading) {
    return (
      <main className="page-container">
        <section className="tool-form-card">
          <p>Loading tool…</p>
        </section>
      </main>
    );
  }

  if (!tool) {
    return (
      <main className="page-container">
        <section className="tool-form-card">
          <p className="eyebrow">Edit Tool</p>
          <h1>Tool not found</h1>
          <p className="page-subtitle">
            {loadError || 'The tool you are trying to edit does not exist.'}
          </p>
          <Link className="secondary-link" to="/tools">
            Back to Browse Tools
          </Link>
        </section>
      </main>
    );
  }

  if (user?.id !== tool.owner_id) {
    return (
      <main className="page-container">
        <section className="tool-form-card">
          <p className="eyebrow">Edit Tool</p>
          <h1>Not allowed</h1>
          <p className="page-subtitle">You can only edit your own tool listings.</p>
          <Link className="secondary-link" to={`/tools/${tool.id}`}>
            Back to Tool Detail
          </Link>
        </section>
      </main>
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);
    try {
      const updated = await toolsApi.update(tool.id, {
        name: name.trim() || undefined,
        description: description.trim() || undefined,
        category,
        condition,
      });
      setTool(updated);
      setSuccessMessage('Changes saved.');
    } catch (err) {
      if (err instanceof ApiError) setErrorMessage(err.message);
      else setErrorMessage('Failed to save changes.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddPhotos = async () => {
    if (newPhotoFiles.length === 0) return;
    setErrorMessage('');
    setSuccessMessage('');
    setIsAddingPhotos(true);
    try {
      const updated = await toolsApi.addPhotos(tool.id, newPhotoFiles);
      setTool(updated);
      setNewPhotoFiles([]);
      setSuccessMessage(`Added ${newPhotoFiles.length} photo(s).`);
    } catch (err) {
      if (err instanceof ApiError) setErrorMessage(err.message);
      else setErrorMessage('Failed to add photos.');
    } finally {
      setIsAddingPhotos(false);
    }
  };

  const handleRemovePhoto = async (photoId: string) => {
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await toolsApi.removePhoto(tool.id, photoId);
      setTool({
        ...tool,
        photos: tool.photos.filter((p) => p.id !== photoId),
      });
      setSuccessMessage('Photo removed.');
    } catch (err) {
      if (err instanceof ApiError) setErrorMessage(err.message);
      else setErrorMessage('Failed to remove photo.');
    }
  };

  const onPhotoSelect = (event: ChangeEvent<HTMLInputElement>) => {
    setNewPhotoFiles(event.target.files ? Array.from(event.target.files) : []);
  };

  return (
    <main className="page-container">
      <section className="page-header split-page-header">
        <div>
          <p className="eyebrow">Edit Tool Listing</p>
          <h1>Edit Tool Listing</h1>
          <p className="page-subtitle">
            Update listing details and manage photos.
          </p>
        </div>

        <div className="header-actions">
          <Link className="secondary-link" to={`/tools/${tool.id}`}>
            Back to Tool Detail
          </Link>
        </div>
      </section>

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
                maxLength={255}
              />
            </label>

            <label>
              Category
              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as ToolCategory)
                }
              >
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {categoryLabels[cat]}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Condition
              <select
                value={condition}
                onChange={(event) =>
                  setCondition(event.target.value as ToolCondition)
                }
              >
                {conditionOptions.map((c) => (
                  <option key={c} value={c}>
                    {conditionLabels[c]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              placeholder="Describe the tool and any notes for borrowers."
              maxLength={5000}
            />
          </label>

          <div className="photo-management-section">
            <h3>Photos</h3>
            <p className="helper-text">
              The first photo is the thumbnail. The backend enforces a
              1–5 photo total per tool, max 5 MB each, JPEG/PNG/WebP/GIF
              only. Edits here are persisted immediately when you click
              "Add" or "Remove"; remember to Save Changes to persist the
              listing fields above.
            </p>

            <div className="photo-list">
              {tool.photos.map((photo, index) => (
                <article className="photo-list-item" key={photo.id}>
                  <img
                    src={absolutePhotoUrl(photo.url)}
                    alt={`Photo ${index + 1}`}
                  />
                  <div>
                    <strong>
                      Photo {index + 1}
                      {index === 0 ? ' — Thumbnail' : ''}
                    </strong>
                    <p className="photo-path">{photo.url}</p>
                    <div className="photo-action-row">
                      <button
                        type="button"
                        className="danger-button small-button"
                        onClick={() => handleRemovePhoto(photo.id)}
                        disabled={tool.photos.length <= 1}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="photo-add-row">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                onChange={onPhotoSelect}
              />
              <button
                type="button"
                className="secondary-button"
                onClick={handleAddPhotos}
                disabled={isAddingPhotos || newPhotoFiles.length === 0}
              >
                {isAddingPhotos
                  ? 'Uploading…'
                  : `Add ${newPhotoFiles.length || ''} Photo${
                      newPhotoFiles.length === 1 ? '' : 's'
                    }`.trim()}
              </button>
            </div>
          </div>

          {errorMessage && <p className="error-message">{errorMessage}</p>}
          {successMessage && <p className="success-message">{successMessage}</p>}

          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save Changes'}
          </button>
        </form>

        <aside className="tool-preview-card">
          <h2>Live Preview</h2>

          {tool.photos[0] ? (
            <img
              className="tool-preview-image"
              src={absolutePhotoUrl(tool.photos[0].url)}
              alt={`${name} preview`}
            />
          ) : (
            <div className="tool-preview-image tool-image-placeholder">
              No photo
            </div>
          )}

          <h3>{name || 'Tool Name'}</h3>

          <p>
            <strong>Category:</strong> {categoryLabels[category]}
          </p>

          <p>
            <strong>Condition:</strong> {conditionLabels[condition]}
          </p>

          <p>
            <strong>Description:</strong> {description || '—'}
          </p>
        </aside>
      </section>
    </main>
  );
}

export default EditToolPage;
