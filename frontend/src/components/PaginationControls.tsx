import { DEFAULT_PAGE_SIZE } from '../hooks/useClientPagination';

interface PaginationControlsProps {
  currentPage: number;
  itemLabel?: string;
  onPageChange: (page: number) => void;
  pageSize?: number;
  totalItems: number;
  totalPages: number;
}

/**
 * Shared page navigation for Issue #139.
 *
 * Includes first, previous, next, and last controls together with an
 * accessible current-page and item-range summary.
 */
function PaginationControls({
  currentPage,
  itemLabel = 'items',
  onPageChange,
  pageSize = DEFAULT_PAGE_SIZE,
  totalItems,
  totalPages,
}: PaginationControlsProps) {
  if (totalItems === 0) {
    return null;
  }

  const safeTotalPages = Math.max(1, totalPages);

  const safeCurrentPage = Math.min(
    Math.max(currentPage, 1),
    safeTotalPages,
  );

  const firstItem =
    (safeCurrentPage - 1) * pageSize + 1;

  const lastItem = Math.min(
    safeCurrentPage * pageSize,
    totalItems,
  );

  const isFirstPage = safeCurrentPage === 1;
  const isLastPage = safeCurrentPage === safeTotalPages;

  return (
    <nav
      className="pagination-controls"
      aria-label={`${itemLabel} pagination`}
    >
      <p className="pagination-summary">
        Showing {firstItem}-{lastItem} of {totalItems} {itemLabel}
      </p>

      <div className="pagination-button-group">
        <button
          type="button"
          className="secondary-button pagination-button"
          disabled={isFirstPage}
          onClick={() => onPageChange(1)}
        >
          First
        </button>

        <button
          type="button"
          className="secondary-button pagination-button"
          disabled={isFirstPage}
          onClick={() =>
            onPageChange(safeCurrentPage - 1)
          }
        >
          Previous
        </button>

        <span
          className="pagination-page-status"
          aria-live="polite"
        >
          Page {safeCurrentPage} of {safeTotalPages}
        </span>

        <button
          type="button"
          className="secondary-button pagination-button"
          disabled={isLastPage}
          onClick={() =>
            onPageChange(safeCurrentPage + 1)
          }
        >
          Next
        </button>

        <button
          type="button"
          className="secondary-button pagination-button"
          disabled={isLastPage}
          onClick={() => onPageChange(safeTotalPages)}
        >
          Last
        </button>
      </div>
    </nav>
  );
}

export default PaginationControls;
