import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  categoryLabels,
  type ToolCategory,
  type ToolCondition,
} from '../data/mockData';

/**
 * CreateToolPage
 *
 * This page supports US8 Create Tool for the R1 frontend demo.
 * It uses local form state only. Later, Ivan can connect this form to
 * the backend create tool endpoint.
 */
function CreateToolPage() {
  const [toolName, setToolName] = useState('');
  const [category, setCategory] = useState<ToolCategory | ''>('');
  const [condition, setCondition] = useState<ToolCondition | ''>('');
  const [description, setDescription] = useState('');
  const [availableFrom, setAvailableFrom] = useState('');
  const [availableTo, setAvailableTo] = useState('');
  const [latestReturnTime, setLatestReturnTime] = useState('');
  const [notesForBorrowers, setNotesForBorrowers] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const categoryOptions = Object.entries(categoryLabels) as Array<
    [ToolCategory, string]
  >;

  const conditionOptions: ToolCondition[] = [
    'New',
    'Like New',
    'Good',
    'Fair',
    'Poor',
  ];

  /**
   * Handles mock tool creation.
   *
   * For the R1 demo, this does not save to the backend yet.
   * It validates the form and shows a success message.
   */
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (
      !toolName ||
      !category ||
      !condition ||
      !description ||
      !availableFrom ||
      !availableTo ||
      !latestReturnTime
    ) {
      setSuccessMessage('Please complete all required fields before submitting.');
      return;
    }

    if (availableTo < availableFrom) {
      setSuccessMessage('Available To date cannot be before Available From date.');
      return;
    }

    setSuccessMessage(
      `Mock tool listing created: ${toolName}. Category: ${categoryLabels[category]}.`,
    );
  };

  const previewImage =
    photoUrl || `https://placehold.co/600x400?text=${encodeURIComponent(toolName || 'New Tool')}`;

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Create Tool</p>
          <h1>Add a New Tool Listing</h1>
          <p className="page-description">
            Create a mock tool listing for the R1 demo. Categories match the
            backend enum so Ivan can wire this page to the API later.
          </p>
        </div>

        <Link className="secondary-link" to="/tools">
          Back to Browse Tools
        </Link>
      </div>

      <div className="tool-form-layout">
        <form className="tool-form-card" onSubmit={handleSubmit}>
          <p className="eyebrow">US8 Create Tool</p>
          <h2>Tool Listing Form</h2>

          <div className="form-grid">
            <label>
              Tool Name *
              <input
                type="text"
                value={toolName}
                onChange={(event) => setToolName(event.target.value)}
                placeholder="Example: Cordless Drill"
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
                {categoryOptions.map(([categoryValue, label]) => (
                  <option key={categoryValue} value={categoryValue}>
                    {label}
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
                {conditionOptions.map((conditionValue) => (
                  <option key={conditionValue} value={conditionValue}>
                    {conditionValue}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Latest Return Time *
              <input
                type="time"
                value={latestReturnTime}
                onChange={(event) => setLatestReturnTime(event.target.value)}
                required
              />
            </label>

            <label>
              Available From *
              <input
                type="date"
                value={availableFrom}
                onChange={(event) => setAvailableFrom(event.target.value)}
                required
              />
            </label>

            <label>
              Available To *
              <input
                type="date"
                value={availableTo}
                onChange={(event) => setAvailableTo(event.target.value)}
                required
              />
            </label>
          </div>

          <label>
            Description *
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe the tool and what it can be used for."
              rows={4}
              required
            />
          </label>

          <label>
            Notes for Borrowers
            <textarea
              value={notesForBorrowers}
              onChange={(event) => setNotesForBorrowers(event.target.value)}
              placeholder="Example: Please clean before returning."
              rows={3}
            />
          </label>

          <label>
            Photo URL
            <input
              type="url"
              value={photoUrl}
              onChange={(event) => setPhotoUrl(event.target.value)}
              placeholder="Optional image URL for demo"
            />
          </label>

          <p className="hst-note">
            Availability dates are interpreted in Hawaii Standard Time (HST).
          </p>

          <button type="submit">Create Mock Tool Listing</button>

          {successMessage && (
            <div className="success-message" role="status">
              {successMessage}
            </div>
          )}
        </form>

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
