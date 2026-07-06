import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toolsApi } from '../api/tools';
import { useAuth } from '../context/useAuth';
import { ApiRequestError } from '../api/client';
import type { ToolCategory, ToolCondition, ToolResponse } from '../types/api';

const categoryLabels: Record<string, string> = {
  HAND_TOOLS: 'Hand Tools', POWER_TOOLS: 'Power Tools', GARDEN_TOOLS: 'Garden Tools',
  CLEANING_TOOLS: 'Cleaning Tools', OUTDOOR_GEAR: 'Outdoor Gear',
};
const categoryOptions = Object.entries(categoryLabels) as Array<[string, string]>;
const conditionOptions: ToolCondition[] = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR'];

function EditToolPage() {
  const { toolId } = useParams();
  const { user } = useAuth();
  const [tool, setTool] = useState<ToolResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ToolCategory | ''>('');
  const [condition, setCondition] = useState<ToolCondition | ''>('');
  const [description, setDescription] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deactivationReason, setDeactivationReason] = useState('');
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);

  const loadTool = useCallback(async () => {
    if (!toolId) return;
    setIsLoading(true);
    try {
      const t = await toolsApi.get(toolId);
      setTool(t);
      setName(t.name);
      setCategory(t.category);
      setCondition(t.condition);
      setDescription(t.description || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tool not found');
    } finally {
      setIsLoading(false);
    }
  }, [toolId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTool();
  }, [loadTool]);

  const isOwner = user && tool && user.id === tool.owner_id;

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionMessage('');
    if (!name.trim()) { setActionMessage('Tool name is required.'); return; }
    if (!category) { setActionMessage('Category is required.'); return; }
    if (!condition) { setActionMessage('Condition is required.'); return; }

    setIsSaving(true);
    try {
      const updated = await toolsApi.update(toolId!, {
        name: name.trim(),
        description: description.trim() || undefined,
        category: category as ToolCategory,
        condition: condition as ToolCondition,
      });
      setTool(updated);
      setActionMessage('Tool listing updated successfully.');
    } catch (err) {
      setActionMessage(err instanceof ApiRequestError ? err.detail : 'Failed to update.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivate = async () => {
    setActionMessage('');
    if (!deactivationReason.trim()) { setActionMessage('A reason is required.'); return; }
    setIsDeactivating(true);
    try {
      const updated = await toolsApi.deactivate(toolId!, { reason: deactivationReason.trim() });
      setTool(updated);
      setActionMessage('Tool deactivated successfully.');
    } catch (err) {
      setActionMessage(err instanceof ApiRequestError ? err.detail : 'Failed to deactivate.');
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleReactivate = async () => {
    setActionMessage('');
    setIsReactivating(true);
    try {
      const updated = await toolsApi.reactivate(toolId!);
      setTool(updated);
      setActionMessage('Tool reactivated successfully.');
    } catch (err) {
      setActionMessage(err instanceof ApiRequestError ? err.detail : 'Failed to reactivate.');
    } finally {
      setIsReactivating(false);
    }
  };

  if (isLoading) {
    return <section className="page-section"><div className="page-header"><h1>Loading...</h1></div></section>;
  }

  if (!tool || error) {
    return (
      <section className="page-section">
        <div className="tool-form-card">
          <p className="eyebrow">Edit Tool</p>
          <h1>Tool not found</h1>
          <p className="page-description">{error || 'The tool does not exist.'}</p>
          <Link className="secondary-link" to="/tools">Back to Browse Tools</Link>
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
          <p className="page-description">Only the tool owner can edit this listing.</p>
          <Link className="secondary-link" to={`/tools/${tool.id}`}>Back to Tool Detail</Link>
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
        <Link className="secondary-link" to={`/tools/${tool.id}`}>Back to Tool Detail</Link>
      </div>

      <div className="tool-form-layout">
        <form className="tool-form-card" onSubmit={handleSave} noValidate>
          <p className="eyebrow">US9 Edit Tool</p>
          <h2>Edit Listing</h2>

          <div className="form-grid">
            <label htmlFor="edit-tool-name">
              Tool Name *
              <input id="edit-tool-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
            </label>

            <label htmlFor="edit-tool-category">
              Category *
              <select id="edit-tool-category" value={category} onChange={(e) => setCategory(e.target.value as ToolCategory | '')}>
                <option value="">Select category</option>
                {categoryOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>

            <label htmlFor="edit-tool-condition">
              Condition *
              <select id="edit-tool-condition" value={condition} onChange={(e) => setCondition(e.target.value as ToolCondition | '')}>
                <option value="">Select condition</option>
                {conditionOptions.map((v) => <option key={v} value={v}>{v.replace('_', ' ')}</option>)}
              </select>
            </label>
          </div>

          <label htmlFor="edit-tool-description">
            Description *
            <textarea id="edit-tool-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          </label>

          <p>
            <strong>Status:</strong> {tool.is_active ? 'Active' : 'Deactivated'}
            {tool.deactivation_reason && <> — Reason: {tool.deactivation_reason}</>}
          </p>

          <button className="primary-button" type="submit" disabled={isSaving || !tool.is_active}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>

          {actionMessage && (
            <p className={actionMessage.includes('fail') || actionMessage.includes('error') || actionMessage.includes('required') ? 'form-error' : 'success-message'}>
              {actionMessage}
            </p>
          )}
        </form>

        <aside className="tool-preview-card">
          <p className="eyebrow">US10 Listing Lifecycle</p>
          <h2>Deactivate / Reactivate</h2>

          {tool.is_active ? (
            <div>
              <p>Deactivate this listing to temporarily remove it from browse results. Any existing REQUESTED/APPROVED reservations will be auto-cancelled.</p>
              <label htmlFor="deactivation-reason">
                Reason *
                <input id="deactivation-reason" type="text" value={deactivationReason} onChange={(e) => setDeactivationReason(e.target.value)} placeholder="Why are you deactivating this listing?" />
              </label>
              <button className="action-button danger-button" type="button" onClick={handleDeactivate} disabled={isDeactivating}>
                {isDeactivating ? 'Deactivating...' : 'Deactivate Listing'}
              </button>
            </div>
          ) : (
            <div>
              <p>This listing is currently deactivated. Reactivate it to make it available again. (Admin-only in production.)</p>
              <button className="action-button approve-button" type="button" onClick={handleReactivate} disabled={isReactivating}>
                {isReactivating ? 'Reactivating...' : 'Reactivate Listing'}
              </button>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

export default EditToolPage;
