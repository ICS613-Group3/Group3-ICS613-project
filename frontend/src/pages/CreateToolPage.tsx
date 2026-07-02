import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ApiError,
  toolsApi,
  type ToolCategory,
  type ToolCondition,
} from '../api/client';

const categoryLabels: Record<ToolCategory, string> = {
  HAND_TOOLS: 'Hand Tools',
  POWER_TOOLS: 'Power Tools',
  GARDEN_TOOLS: 'Garden Tools',
  CLEANING_TOOLS: 'Cleaning Tools',
  OUTDOOR_GEAR: 'Outdoor Gear',
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

const conditionLabels: Record<ToolCondition, string> = {
  NEW: 'New',
  LIKE_NEW: 'Like New',
  GOOD: 'Good',
  FAIR: 'Fair',
  POOR: 'Poor',
};

/**
 * CreateToolPage
 *
 * Real backend create via ``POST /tools`` (multipart form).
 *
 * Notes:
 * - Photo uploads use ``<input type="file" multiple>`` and are sent as
 *   ``FormData``. The backend enforces 1–5 images, max 5 MB each, and
 *   magic-byte signature checks (JPEG/PNG/WebP/GIF).
 * - Backend has no ``availableFrom``/``availableTo``/``latestReturnTime``/
 *   ``notesForBorrowers`` fields. These were dropped (see the R1
 *   integration contract). Notes can be folded into ``description``.
 */
function CreateToolPage() {
  const navigate = useNavigate();
  const [toolName, setToolName] = useState('');
  const [category, setCategory] = useState<ToolCategory | ''>('');
  const [condition, setCondition] = useState<ToolCondition | ''>('');
  const [description, setDescription] = useState('');
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    if (!category || !condition) {
      setErrorMessage('Please select both a category and a condition.');
      return;
    }
    setIsSubmitting(true);
    try {
      const created = await toolsApi.create({
        name: toolName.trim(),
        category: category as ToolCategory,
        condition: condition as ToolCondition,
        description: description.trim() || undefined,
        photos: photoFiles.length > 0 ? photoFiles : undefined,
      });
      navigate(`/tools/${created.id}`);
    } catch (err) {
      if (err instanceof ApiError) setErrorMessage(err.message);
      else setErrorMessage('Failed to create tool.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Create Tool</p>
          <h1>Add a New Tool Listing</h1>
          <p className="page-description">
            List a tool you are willing to share. Categories and conditions
            match the backend enum values.
          </p>
        </div>

        <Link className="secondary-link" to="/tools">
          Back to Browse Tools
        </Link>
      </div>

      <div className="tool-form-layout">
        <form className="tool-form-card" onSubmit={handleSubmit}>
          <p className="eyebrow">Create Tool Listing</p>
          <h2>Tool Listing Form</h2>

          <div className="form-grid">
            <label>
              Tool Name *
              <input
                type="text"
                value={toolName}
                onChange={(event) => setToolName(event.target.value)}
                placeholder="Example: Cordless Drill"
                maxLength={255}
                required
              />
            </label>

            <label>
              Category *
              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as ToolCategory | '')
                }
                required
              >
                <option value="">Select category</option>
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {categoryLabels[cat]}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Condition *
              <select
                value={condition}
                onChange={(event) =>
                  setCondition(event.target.value as ToolCondition | '')
                }
                required
              >
                <option value="">Select condition</option>
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
              placeholder="Describe the tool and any notes for borrowers."
              rows={5}
              maxLength={5000}
            />
          </label>

          <label>
            Photos (1–5 images, JPEG/PNG/WebP/GIF, max 5 MB each)
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={(event) => {
                const files = event.target.files ? Array.from(event.target.files) : [];
                setPhotoFiles(files);
              }}
            />
          </label>

          {photoFiles.length > 0 && (
            <p className="helper-text">
              {photoFiles.length} photo{photoFiles.length === 1 ? '' : 's'} selected.
            </p>
          )}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating…' : 'Create Tool Listing'}
          </button>

          {errorMessage && (
            <p className="error-message" role="alert">
              {errorMessage}
            </p>
          )}
        </form>

        <aside className="tool-preview-card">
          <p className="eyebrow">Preview</p>
          <h2>Listing Preview</h2>

          {photoFiles[0] ? (
            <img
              src={URL.createObjectURL(photoFiles[0])}
              alt="Tool preview"
              className="tool-preview-image"
            />
          ) : (
            <div className="tool-preview-image tool-image-placeholder">
              Upload a photo to preview
            </div>
          )}

          <div className="tool-card-top">
            <span className="status-badge">
              {category ? categoryLabels[category] : 'Category'}
            </span>
            <span className="rating">New listing</span>
          </div>

          <h3>{toolName || 'New Tool Name'}</h3>
          <p>{description || 'Description will appear here.'}</p>

          <dl className="detail-meta-grid">
            <div>
              <dt>Condition</dt>
              <dd>{condition ? conditionLabels[condition] : 'Not selected'}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  );
}

export default CreateToolPage;
