import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toolsApi } from '../api/tools';
import { ApiRequestError } from '../api/client';
import type { ToolCategory, ToolCondition } from '../types/api';

const categoryLabels: Record<string, string> = {
  HAND_TOOLS: 'Hand Tools',
  POWER_TOOLS: 'Power Tools',
  GARDEN_TOOLS: 'Garden Tools',
  CLEANING_TOOLS: 'Cleaning Tools',
  OUTDOOR_GEAR: 'Outdoor Gear',
};

const categoryOptions = Object.entries(categoryLabels) as Array<[string, string]>;

const conditionOptions: ToolCondition[] = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR'];

const maxPhotoSizeBytes = 5 * 1024 * 1024;
const maxPhotoCount = 5;
const allowedPhotoTypes = ['image/jpeg', 'image/png', 'image/webp'];

function CreateToolPage() {
  const navigate = useNavigate();
  const [toolName, setToolName] = useState('');
  const [category, setCategory] = useState<ToolCategory | ''>('');
  const [condition, setCondition] = useState<ToolCondition | ''>('');
  const [description, setDescription] = useState('');
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handlePhotoUpload(event: ChangeEvent<HTMLInputElement>) {
    setErrorMessage('');
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (photoFiles.length >= maxPhotoCount) {
      setErrorMessage(`Maximum ${maxPhotoCount} photos allowed.`);
      event.target.value = '';
      return;
    }

    if (!allowedPhotoTypes.includes(selectedFile.type)) {
      setErrorMessage('Photos must be JPG, PNG, or WebP.');
      event.target.value = '';
      return;
    }

    if (selectedFile.size > maxPhotoSizeBytes) {
      setErrorMessage('Each photo must be 5 MB or smaller.');
      event.target.value = '';
      return;
    }

    setPhotoFiles((prev) => [...prev, selectedFile]);
    setPhotoPreviews((prev) => [...prev, URL.createObjectURL(selectedFile)]);
    event.target.value = '';
  }

  function handleRemovePhoto(index: number) {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!toolName.trim()) { setErrorMessage('Tool name is required.'); return; }
    if (!category) { setErrorMessage('Category is required.'); return; }
    if (!condition) { setErrorMessage('Condition is required.'); return; }
    if (!description.trim()) { setErrorMessage('Description is required.'); return; }
    if (photoFiles.length < 1) { setErrorMessage('At least one photo is required.'); return; }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('name', toolName.trim());
      formData.append('category', category);
      formData.append('condition', condition);
      formData.append('description', description.trim());
      photoFiles.forEach((file) => formData.append('photos', file));

      const created = await toolsApi.create(formData);
      setSuccessMessage(`Tool listing created: ${created.name}`);
      setTimeout(() => navigate(`/tools/${created.id}`), 1500);
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.detail : 'Failed to create tool.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const previewImage = photoPreviews[0] || `https://placehold.co/600x400?text=${encodeURIComponent(toolName || 'New Tool')}`;

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Create Tool</p>
          <h1>Add a New Tool Listing</h1>
          <p className="page-description">
            Create a new tool listing. Photos are uploaded to the backend.
          </p>
        </div>
        <Link className="secondary-link" to="/tools">Back to Browse Tools</Link>
      </div>

      <div className="tool-form-layout">
        <form className="tool-form-card" onSubmit={handleSubmit} noValidate>
          <p className="eyebrow">US8 Create Tool</p>
          <h2>Tool Listing Form</h2>

          <div className="form-grid">
            <label htmlFor="create-tool-name">
              Tool Name *
              <input id="create-tool-name" type="text" value={toolName} onChange={(e) => setToolName(e.target.value)} placeholder="Example: Cordless Drill" />
            </label>

            <label htmlFor="create-tool-category">
              Category *
              <select id="create-tool-category" value={category} onChange={(e) => setCategory(e.target.value as ToolCategory | '')}>
                <option value="">Select category</option>
                {categoryOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>

            <label htmlFor="create-tool-condition">
              Condition *
              <select id="create-tool-condition" value={condition} onChange={(e) => setCondition(e.target.value as ToolCondition | '')}>
                <option value="">Select condition</option>
                {conditionOptions.map((v) => <option key={v} value={v}>{v.replace('_', ' ')}</option>)}
              </select>
            </label>
          </div>

          <label htmlFor="create-tool-description">
            Description *
            <textarea id="create-tool-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the tool" rows={4} />
          </label>

          <label htmlFor="create-tool-photo">
            Tool Photos * (1–{maxPhotoCount})
            <input id="create-tool-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoUpload} />
          </label>
          <p className="auth-helper-text">Accepted: JPG, PNG, WebP. Max 5 MB each.</p>

          {photoPreviews.length > 0 && (
            <div className="photo-list">
              {photoPreviews.map((preview, i) => (
                <article className="photo-list-item" key={i}>
                  <img src={preview} alt={`Photo ${i + 1}`} />
                  <div>
                    <strong>Photo {i + 1}{i === 0 ? ' - Thumbnail' : ''}</strong>
                    <p>{photoFiles[i].name}</p>
                    <button type="button" className="secondary-button small-button" onClick={() => handleRemovePhoto(i)}>Remove</button>
                  </div>
                </article>
              ))}
            </div>
          )}

          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Tool Listing'}
          </button>

          {errorMessage && <p className="form-error">{errorMessage}</p>}
          {successMessage && <div className="success-message" role="status">{successMessage}</div>}
        </form>

        <aside className="tool-preview-card">
          <p className="eyebrow">Preview</p>
          <h2>Listing Preview</h2>
          <img src={previewImage} alt="Tool preview" className="tool-preview-image" />
          <div className="tool-card-top">
            <span className="status-badge">{category ? categoryLabels[category] : 'Category'}</span>
          </div>
          <h3>{toolName || 'Tool Name'}</h3>
          <p>{description || 'Description preview...'}</p>
          <p><strong>Condition:</strong> {condition || 'Not set'}</p>
        </aside>
      </div>
    </section>
  );
}

export default CreateToolPage;
