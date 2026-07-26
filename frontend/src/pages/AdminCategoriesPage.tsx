import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { categoriesApi } from '../api/categories';
import type { CategoryResponse } from '../api/categories';
import { useAuth } from '../context/useAuth';
import { ApiRequestError } from '../api/client';

function AdminCategoriesPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [searchText, setSearchText] = useState('');

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const data = await categoriesApi.list();
      setCategories(data.categories);
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.detail : 'Failed to load categories.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    if (!newName.trim()) {
      setErrorMessage('Category name is required.');
      return;
    }
    setIsCreating(true);
    try {
      await categoriesApi.create({ name: newName.trim(), description: newDescription.trim() || undefined });
      setSuccessMessage(`Category "${newName.trim()}" created.`);
      setNewName('');
      setNewDescription('');
      await loadCategories();
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.detail : 'Failed to create category.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRemove = async (cat: CategoryResponse) => {
    if (!window.confirm(`Remove category "${cat.name}"?`)) return;
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await categoriesApi.remove(cat.id);
      setSuccessMessage(`Category "${cat.name}" removed.`);
      await loadCategories();
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.detail : 'Failed to remove category.');
    }
  };

  if (!user?.is_admin) {
    return (
      <section className="page-section">
        <div className="empty-state-card">
          <h1>Access Denied</h1>
          <p>You must be an admin to manage categories.</p>
        </div>
      </section>
    );
  }

  const filtered = categories.filter((cat) => {
    if (!searchText) return true;
    return cat.name.toLowerCase().includes(searchText.toLowerCase());
  });

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">US28 — Category Management</p>
          <h1>Tool Categories</h1>
          <p className="page-description">
            Add or remove tool categories that members can use when listing tools.
          </p>
        </div>
      </div>

      {/* Create form */}
      <form className="form-card" onSubmit={handleCreate}>
        <h2>Add New Category</h2>
        <label htmlFor="cat-name">
          Category Name *
          <input
            id="cat-name"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Automotive Tools"
            required
            maxLength={100}
          />
        </label>
        <label htmlFor="cat-desc">
          Description
          <input
            id="cat-desc"
            type="text"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Optional description"
            maxLength={2000}
          />
        </label>
        <button type="submit" className="primary-button" disabled={isCreating}>
          {isCreating ? 'Creating...' : 'Add Category'}
        </button>
        {errorMessage && <p className="form-error">{errorMessage}</p>}
        {successMessage && <p className="form-success">{successMessage}</p>}
      </form>

      {/* Filter */}
      <div className="filter-panel">
        <input
          type="text"
          placeholder="Search by category name"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <button className="secondary-button" onClick={loadCategories} disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {isLoading && <p>Loading categories...</p>}

      {!isLoading && (
        <div className="responsive-table-wrapper">
          <table className="invite-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Created At</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cat) => (
                <tr key={cat.id}>
                  <td>{cat.name}</td>
                  <td>{cat.description || '—'}</td>
                  <td>{new Date(cat.created_at).toLocaleDateString()}</td>
                  <td>
                    <button
                      type="button"
                      className="action-button danger-button"
                      onClick={() => handleRemove(cat)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={4}>No categories found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default AdminCategoriesPage;
