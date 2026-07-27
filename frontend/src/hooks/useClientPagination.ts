import { useEffect, useMemo, useState } from 'react';

/**
 * Issue #139 requires twenty records per page.
 */
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Reusable client-side pagination for list screens that currently receive
 * complete arrays or use frontend mock data.
 *
 * resetKey should change whenever the page's search or filters change.
 */
export function useClientPagination<T>(
  items: T[],
  resetKey = '',
  pageSize = DEFAULT_PAGE_SIZE,
) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(
    1,
    Math.ceil(items.length / pageSize),
  );

  /**
   * Search and filter changes always return the user to page one.
   */
  useEffect(() => {
    setCurrentPage(1);
  }, [resetKey]);

  /**
   * Keep the current page valid when records are removed or filtered.
   */
  useEffect(() => {
    setCurrentPage((page) =>
      Math.min(Math.max(page, 1), totalPages),
    );
  }, [totalPages]);

  const pageItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;

    return items.slice(
      startIndex,
      startIndex + pageSize,
    );
  }, [currentPage, items, pageSize]);

  return {
    currentPage,
    pageItems,
    pageSize,
    setCurrentPage,
    totalPages,
  };
}
