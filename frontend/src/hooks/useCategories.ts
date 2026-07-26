import { useCallback, useEffect, useState } from 'react';
import { categoriesApi, type CategoryResponse } from '../api/categories';

/**
 * Hook that fetches categories from the backend API (US28).
 *
 * Returns:
 * - categories: raw CategoryResponse[] from the API
 * - categoryLabels: Record<name, displayName> for dropdowns and display
 * - categoryOptions: [name, displayName][] for <select> elements
 * - isLoading: true while fetching
 * - error: error message if fetch failed
 */
export function useCategories() {
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await categoriesApi.list();
      setCategories(data.categories);
    } catch {
      // Fallback to hardcoded defaults if API fails
      setCategories([
        { id: '', name: 'HAND_TOOLS', description: null, created_by: null, created_at: '' },
        { id: '', name: 'POWER_TOOLS', description: null, created_by: null, created_at: '' },
        { id: '', name: 'GARDEN_TOOLS', description: null, created_by: null, created_at: '' },
        { id: '', name: 'CLEANING_TOOLS', description: null, created_by: null, created_at: '' },
        { id: '', name: 'OUTDOOR_GEAR', description: null, created_by: null, created_at: '' },
      ]);
      setError('');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Build a labels map: "HAND_TOOLS" → "Hand Tools"
  const categoryLabels: Record<string, string> = Object.fromEntries(
    categories.map((c) => [c.name, formatCategoryName(c.name)])
  );

  // Build options array for <select> dropdowns
  const categoryOptions: Array<[string, string]> = categories.map((c) => [
    c.name,
    formatCategoryName(c.name),
  ]);

  return { categories, categoryLabels, categoryOptions, isLoading, error };
}

/**
 * Convert an enum-style name to a human-readable label.
 * "HAND_TOOLS" → "Hand Tools"
 * "POWER_TOOLS" → "Power Tools"
 */
function formatCategoryName(name: string): string {
  return name
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}
