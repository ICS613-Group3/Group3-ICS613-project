import { useMemo, useState } from 'react';

import { Link } from 'react-router-dom';

import {
  categoryLabels,
  mockReservations,
  mockTools,
} from '../data/mockData';

/**
 * AdminListingStatus
 *
 * Admin listing controls use a frontend-only status for the R1 demo.
 * The real backend can later store listing status in the database.
 */
type AdminListingStatus = 'active' | 'deactivated';

/**
 * AdminAuditAction
 *
 * These are the mock admin actions shown in the audit log preview.
 */
type AdminAuditAction = 'DEACTIVATED' | 'REACTIVATED';

/**
 * ManagedListing
 *
 * Stores frontend-only admin listing state.
 * This lets the admin page show activate/deactivate behavior without backend.
 */
interface ManagedListing {
  toolId: string;
  status: AdminListingStatus;
  lastActionReason?: string;
  lastUpdatedAt?: string;
}

/**
 * AdminAuditEntry
 *
 * Stores a small frontend-only audit log preview.
 * The real app will later use backend audit log records.
 */
interface AdminAuditEntry {
  id: string;
  toolName: string;
  action: AdminAuditAction;
  reason: string;
  createdAt: string;
}

/**
 * Initial listing status for the mock admin page.
 *
 * Most tools begin active.
 * tool-4 begins deactivated so the Reactivate flow can be tested immediately.
 */
const initialManagedListings: ManagedListing[] = mockTools.map((tool) => ({
  toolId: tool.id,
  status: tool.id === 'tool-4' ? 'deactivated' : 'active',
  lastActionReason:
    tool.id === 'tool-4'
      ? 'Mock starting state: temporarily removed for maintenance.'
      : undefined,
  lastUpdatedAt: tool.id === 'tool-4' ? '2026-07-04 09:00 HST' : undefined,
}));

/**
 * Statuses that can be automatically cancelled in the mock admin UI.
 *
 * For US11:
 * - REQUESTED and APPROVED reservations can be shown as auto-cancel candidates.
 * - PICKED_UP reservations block admin deactivation.
 */
const autoCancelCandidateStatuses = ['REQUESTED', 'APPROVED'];

/**
 * Create a readable HST timestamp for frontend demo messages.
 *
 * This is frontend display only.
 * Backend should later create the authoritative audit timestamp.
 */
function getMockHstTimestamp() {
  return `${new Date().toLocaleString('en-US', {
    timeZone: 'Pacific/Honolulu',
  })} HST`;
}

/**
 * Build a CSS class for admin listing status badges.
 */
function getListingStatusClass(status: AdminListingStatus) {
  return `admin-listing-status admin-listing-status-${status}`;
}

/**
 * AdminListingsPage
 *
 * US11 Admin Listing Controls UI.
 *
 * Frontend responsibilities:
 * - Show all tool listings to an admin.
 * - Show listing status.
 * - Show active reservation warnings.
 * - Block deactivation when a tool is currently PICKED_UP.
 * - Allow admin to deactivate a listing with a required reason.
 * - Allow admin to reactivate a deactivated listing.
 * - Show a frontend-only audit log preview.
 *
 * Important:
 * - This page is frontend mock behavior for R1.
 * - It does not call a backend API yet.
 * - Backend can later connect these actions to admin listing endpoints.
 */
function AdminListingsPage() {
  // Store frontend-only listing status changes.
  const [managedListings, setManagedListings] = useState<ManagedListing[]>(
    initialManagedListings,
  );

  // Store reason text per tool id.
  const [reasonByToolId, setReasonByToolId] = useState<Record<string, string>>(
    {},
  );

  // Store search text for admin list filtering.
  const [searchText, setSearchText] = useState('');

  // Store listing status filter.
  const [statusFilter, setStatusFilter] = useState<
    'all' | AdminListingStatus
  >('all');

  // Store page-level success and error messages.
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Store frontend-only audit log entries.
  const [auditEntries, setAuditEntries] = useState<AdminAuditEntry[]>([]);

  /**
   * Build display rows by combining mock tools, listing status,
   * and reservation state.
   */
  const listingRows = useMemo(() => {
    return mockTools.map((tool) => {
      const listingState =
        managedListings.find((listing) => listing.toolId === tool.id) ??
        ({
          toolId: tool.id,
          status: 'active',
        } as ManagedListing);

      const reservationsForTool = mockReservations.filter(
        (reservation) => reservation.toolId === tool.id,
      );

      const pickedUpReservations = reservationsForTool.filter(
        (reservation) => reservation.status === 'PICKED_UP',
      );

      const autoCancelReservations = reservationsForTool.filter((reservation) =>
        autoCancelCandidateStatuses.includes(reservation.status),
      );

      return {
        tool,
        listingState,
        reservationsForTool,
        pickedUpReservations,
        autoCancelReservations,
      };
    });
  }, [managedListings]);

  /**
   * Filter rows for search and status filter.
   */
  const filteredListingRows = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    return listingRows.filter((row) => {
      const matchesStatus =
        statusFilter === 'all' || row.listingState.status === statusFilter;

      const matchesSearch =
        !normalizedSearch ||
        row.tool.name.toLowerCase().includes(normalizedSearch) ||
        row.tool.ownerName.toLowerCase().includes(normalizedSearch) ||
        categoryLabels[row.tool.category].toLowerCase().includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [listingRows, searchText, statusFilter]);

  /**
   * Summary counts for admin cards.
   */
  const summaryCounts = useMemo(() => {
    const activeCount = managedListings.filter(
      (listing) => listing.status === 'active',
    ).length;

    const deactivatedCount = managedListings.filter(
      (listing) => listing.status === 'deactivated',
    ).length;

    const pickedUpBlockedCount = listingRows.filter(
      (row) => row.pickedUpReservations.length > 0,
    ).length;

    return {
      active: activeCount,
      deactivated: deactivatedCount,
      pickedUpBlocked: pickedUpBlockedCount,
      total: managedListings.length,
    };
  }, [listingRows, managedListings]);

  /**
   * Update reason text for one tool.
   */
  function handleReasonChange(toolId: string, value: string) {
    setReasonByToolId((currentReasons) => ({
      ...currentReasons,
      [toolId]: value,
    }));
  }

  /**
   * Add a frontend-only audit log entry.
   */
  function addAuditEntry(
    toolName: string,
    action: AdminAuditAction,
    reason: string,
  ) {
    const newAuditEntry: AdminAuditEntry = {
      id: `audit-${Date.now()}`,
      toolName,
      action,
      reason,
      createdAt: getMockHstTimestamp(),
    };

    setAuditEntries((currentEntries) => [newAuditEntry, ...currentEntries]);
  }

  /**
   * US11 deactivate handler.
   *
   * Frontend demo rules:
   * - A reason is required.
   * - A listing already deactivated cannot be deactivated again.
   * - A listing with a PICKED_UP reservation cannot be deactivated.
   * - REQUESTED / APPROVED reservations show an auto-cancel notice.
   */
  function handleDeactivate(toolId: string) {
    setErrorMessage('');
    setSuccessMessage('');

    const row = listingRows.find((currentRow) => currentRow.tool.id === toolId);
    const reason = reasonByToolId[toolId]?.trim() ?? '';

    if (!row) {
      setErrorMessage('Listing not found in mock admin data.');
      return;
    }

    if (row.listingState.status === 'deactivated') {
      setErrorMessage(`${row.tool.name} is already deactivated.`);
      return;
    }

    if (row.pickedUpReservations.length > 0) {
      setErrorMessage(
        `${row.tool.name} cannot be deactivated while it has a PICKED_UP reservation.`,
      );
      return;
    }

    if (!reason) {
      setErrorMessage('A deactivation reason is required.');
      return;
    }

    setManagedListings((currentListings) =>
      currentListings.map((listing) =>
        listing.toolId === toolId
          ? {
              ...listing,
              status: 'deactivated',
              lastActionReason: reason,
              lastUpdatedAt: getMockHstTimestamp(),
            }
          : listing,
      ),
    );

    addAuditEntry(row.tool.name, 'DEACTIVATED', reason);

    setReasonByToolId((currentReasons) => ({
      ...currentReasons,
      [toolId]: '',
    }));

    const autoCancelNote =
      row.autoCancelReservations.length > 0
        ? ` ${row.autoCancelReservations.length} REQUESTED/APPROVED reservation(s) would be auto-cancelled by the backend.`
        : '';

    setSuccessMessage(
      `Mock admin deactivated ${row.tool.name}.${autoCancelNote}`,
    );
  }

  /**
   * US11 reactivate handler.
   *
   * Frontend demo rules:
   * - A listing must be deactivated before it can be reactivated.
   * - Reactivation writes a frontend-only audit log entry.
   */
  function handleReactivate(toolId: string) {
    setErrorMessage('');
    setSuccessMessage('');

    const row = listingRows.find((currentRow) => currentRow.tool.id === toolId);

    if (!row) {
      setErrorMessage('Listing not found in mock admin data.');
      return;
    }

    if (row.listingState.status === 'active') {
      setErrorMessage(`${row.tool.name} is already active.`);
      return;
    }

    setManagedListings((currentListings) =>
      currentListings.map((listing) =>
        listing.toolId === toolId
          ? {
              ...listing,
              status: 'active',
              lastActionReason: 'Mock admin reactivated listing.',
              lastUpdatedAt: getMockHstTimestamp(),
            }
          : listing,
      ),
    );

    addAuditEntry(row.tool.name, 'REACTIVATED', 'Mock admin reactivated listing.');

    setSuccessMessage(`Mock admin reactivated ${row.tool.name}.`);
  }

  return (
    <section className="page-section">
      {/* Page header explains the US11 admin purpose. */}
      <div className="page-header">
        <div>
          <p className="eyebrow">US11 Admin Listing Controls</p>
          <h1>Admin Listing Management</h1>
          <p className="page-description">
            Review tool listings, deactivate listings with a reason, reactivate
            listings, and preview admin audit log behavior for the R1 frontend demo.
          </p>
        </div>

        <Link className="secondary-link header-action-link" to="/admin/invites">
          Admin Invites
        </Link>
      </div>

      {/* Summary cards. */}
      <div className="admin-listing-summary-grid">
        <article className="summary-card">
          <strong>{summaryCounts.total}</strong>
          <span>Total Listings</span>
        </article>

        <article className="summary-card">
          <strong>{summaryCounts.active}</strong>
          <span>Active</span>
        </article>

        <article className="summary-card">
          <strong>{summaryCounts.deactivated}</strong>
          <span>Deactivated</span>
        </article>

        <article className="summary-card">
          <strong>{summaryCounts.pickedUpBlocked}</strong>
          <span>PICKED_UP Block</span>
        </article>
      </div>

      {/* Search and filter controls. */}
      <section className="admin-listing-filter-panel">
        <label htmlFor="admin-listing-search">
          Search Listings
          <input
            id="admin-listing-search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search by tool, owner, or category"
          />
        </label>

        <label htmlFor="admin-listing-status-filter">
          Status Filter
          <select
            id="admin-listing-status-filter"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as 'all' | AdminListingStatus)
            }
          >
            <option value="all">All Listings</option>
            <option value="active">Active</option>
            <option value="deactivated">Deactivated</option>
          </select>
        </label>
      </section>

      {/* Page-level messages. */}
      {errorMessage && <p className="form-error">{errorMessage}</p>}
      {successMessage && <p className="form-success">{successMessage}</p>}

      {/* Admin listing cards. */}
      <section className="admin-listings-grid">
        {filteredListingRows.map((row) => {
          const reasonValue = reasonByToolId[row.tool.id] ?? '';
          const isDeactivated = row.listingState.status === 'deactivated';
          const isPickedUpBlocked = row.pickedUpReservations.length > 0;

          return (
            <article className="admin-listing-card" key={row.tool.id}>
              {/* Listing card header. */}
              <div className="admin-listing-card-header">
                <div>
                  <p className="eyebrow">{categoryLabels[row.tool.category]}</p>
                  <h2>{row.tool.name}</h2>
                  <p>{row.tool.description}</p>
                </div>

                <span className={getListingStatusClass(row.listingState.status)}>
                  {row.listingState.status}
                </span>
              </div>

              {/* Listing metadata. */}
              <dl className="admin-listing-meta-grid">
                <div>
                  <dt>Owner</dt>
                  <dd>{row.tool.ownerName}</dd>
                </div>

                <div>
                  <dt>Condition</dt>
                  <dd>{row.tool.condition}</dd>
                </div>

                <div>
                  <dt>Available</dt>
                  <dd>
                    {row.tool.availableFrom} to {row.tool.availableTo}
                  </dd>
                </div>

                <div>
                  <dt>Latest Return</dt>
                  <dd>{row.tool.latestReturnTime} HST</dd>
                </div>
              </dl>

              {/* Reservation warning area. */}
              {row.reservationsForTool.length > 0 && (
                <section className="admin-reservation-warning">
                  <strong>Reservation status check</strong>

                  <ul>
                    {row.reservationsForTool.map((reservation) => (
                      <li key={reservation.id}>
                        {reservation.status}: {reservation.startDate} to{' '}
                        {reservation.endDate} — Borrower:{' '}
                        {reservation.borrowerName}
                      </li>
                    ))}
                  </ul>

                  {isPickedUpBlocked ? (
                    <p className="picked-up-block-message">
                      This listing cannot be deactivated while a reservation is
                      PICKED_UP.
                    </p>
                  ) : row.autoCancelReservations.length > 0 ? (
                    <p className="auto-cancel-note">
                      If deactivated, REQUESTED/APPROVED reservations would be
                      auto-cancelled by backend logic.
                    </p>
                  ) : (
                    <p className="muted-text">
                      No active reservation blocks for admin action.
                    </p>
                  )}
                </section>
              )}

              {/* Last action note. */}
              {row.listingState.lastActionReason && (
                <section className="admin-last-action">
                  <strong>Last Action Reason</strong>
                  <p>{row.listingState.lastActionReason}</p>
                  {row.listingState.lastUpdatedAt && (
                    <span>{row.listingState.lastUpdatedAt}</span>
                  )}
                </section>
              )}

              {/* Admin action controls. */}
              <section className="admin-listing-actions">
                <label htmlFor={`reason-${row.tool.id}`}>
                  Deactivation Reason
                  <textarea
                    id={`reason-${row.tool.id}`}
                    value={reasonValue}
                    onChange={(event) =>
                      handleReasonChange(row.tool.id, event.target.value)
                    }
                    rows={3}
                    placeholder="Example: Listing violates community rules or the tool is unsafe."
                    disabled={isDeactivated}
                  />
                </label>

                <div className="admin-listing-button-row">
                  <button
                    type="button"
                    className="danger-action-button"
                    onClick={() => handleDeactivate(row.tool.id)}
                    disabled={isDeactivated || isPickedUpBlocked}
                  >
                    Deactivate
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleReactivate(row.tool.id)}
                    disabled={!isDeactivated}
                  >
                    Reactivate
                  </button>

                  <Link className="secondary-link" to={`/tools/${row.tool.id}`}>
                    View
                  </Link>

                  <Link
                    className="secondary-link"
                    to={`/tools/${row.tool.id}/edit`}
                  >
                    Edit
                  </Link>
                </div>
              </section>
            </article>
          );
        })}
      </section>

      {/* Empty state for search/filter. */}
      {filteredListingRows.length === 0 && (
        <section className="empty-state-card">
          <h2>No listings found</h2>
          <p>Try changing the search text or status filter.</p>
        </section>
      )}

      {/* Frontend-only audit log preview. */}
      <section className="admin-audit-log-card">
        <h2>Mock Admin Audit Log Preview</h2>

        {auditEntries.length === 0 ? (
          <p className="muted-text">
            No admin actions yet. Deactivate or reactivate a listing to create a
            mock audit entry.
          </p>
        ) : (
          <div className="responsive-table-wrapper">
            <table className="invite-table">
              <thead>
                <tr>
                  <th>Tool</th>
                  <th>Action</th>
                  <th>Reason</th>
                  <th>Created</th>
                </tr>
              </thead>

              <tbody>
                {auditEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.toolName}</td>
                    <td>{entry.action}</td>
                    <td>{entry.reason}</td>
                    <td>{entry.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Demo note documents frontend-only behavior. */}
      <p className="demo-note">
        Demo note: this page uses mock frontend state. Backend admin endpoints,
        role checks, database listing status, auto-cancel behavior, and audit log
        persistence can be connected later.
      </p>
    </section>
  );
}

export default AdminListingsPage;