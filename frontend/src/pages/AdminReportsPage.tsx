import { useEffect, useMemo, useState } from 'react';

import { Link, Navigate } from 'react-router-dom';

import { authApi } from '../api/auth';
import { ApiRequestError } from '../api/client';
import { mockTools } from '../data/mockData';

type ReportStatus =
  | 'PENDING_REVIEW'
  | 'RESOLVED_VALID'
  | 'RESOLVED_INVALID';

type ListingModerationStatus = 'ACTIVE' | 'DEACTIVATED';

type ReportFilter = 'ALL' | ReportStatus;

interface AdminListingReport {
  id: string;
  toolId: string;
  listingTitle: string;
  ownerName: string;
  reason: string;
  reporterName: string;
  reportedAt: string;
  comment?: string;
  status: ReportStatus;
  listingStatus: ListingModerationStatus;
}

type AccessState =
  | 'loading'
  | 'allowed'
  | 'unauthenticated'
  | 'forbidden'
  | 'error';

const firstTool = mockTools[0];
const secondTool = mockTools[1];
const thirdTool = mockTools[2];

const initialReports: AdminListingReport[] = [
  {
    id: 'report-001',
    toolId: firstTool?.id ?? 'tool-001',
    listingTitle: firstTool?.name ?? 'Cordless Drill',
    ownerName: 'Daniel Kim',
    reason: 'Unsafe tool or condition',
    reporterName: 'Maya Chen',
    reportedAt: '2026-07-22T18:40:00-10:00',
    comment:
      'The electrical cord appears damaged and may be unsafe to use.',
    status: 'PENDING_REVIEW',
    listingStatus: 'ACTIVE',
  },
  {
    id: 'report-002',
    toolId: secondTool?.id ?? 'tool-002',
    listingTitle: secondTool?.name ?? 'Pressure Washer',
    ownerName: 'Leilani Akana',
    reason: 'Misleading listing information',
    reporterName: 'Noah Williams',
    reportedAt: '2026-07-23T09:15:00-10:00',
    comment:
      'The photographs and description appear to show different models.',
    status: 'PENDING_REVIEW',
    listingStatus: 'ACTIVE',
  },
  {
    id: 'report-003',
    toolId: thirdTool?.id ?? 'tool-003',
    listingTitle: thirdTool?.name ?? 'Extension Ladder',
    ownerName: 'Olivia Park',
    reason: 'Other concern',
    reporterName: 'Ethan Lee',
    reportedAt: '2026-07-21T14:25:00-10:00',
    status: 'PENDING_REVIEW',
    listingStatus: 'ACTIVE',
  },
];

function formatReportDate(value: string) {
  return (
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Pacific/Honolulu',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value)) + ' HST'
  );
}

function formatReportStatus(status: ReportStatus) {
  switch (status) {
    case 'PENDING_REVIEW':
      return 'Pending Review';
    case 'RESOLVED_VALID':
      return 'Resolved — Valid';
    case 'RESOLVED_INVALID':
      return 'Resolved — Invalid';
  }
}

function AdminReportsPage() {
  const [accessState, setAccessState] =
    useState<AccessState>('loading');
  const [adminName, setAdminName] = useState('');
  const [accessError, setAccessError] = useState('');

  const [reports, setReports] =
    useState<AdminListingReport[]>(initialReports);
  const [statusFilter, setStatusFilter] =
    useState<ReportFilter>('ALL');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function checkAdminAccess() {
      try {
        const user = await authApi.me();

        if (cancelled) {
          return;
        }

        if (!user.is_admin) {
          setAccessState('forbidden');
          return;
        }

        setAdminName(user.full_name || user.email);
        setAccessState('allowed');
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (error instanceof ApiRequestError && error.status === 401) {
          setAccessState('unauthenticated');
          return;
        }

        if (error instanceof ApiRequestError && error.status === 403) {
          setAccessState('forbidden');
          return;
        }

        setAccessError(
          error instanceof Error
            ? error.message
            : 'Unable to verify administrator access.',
        );
        setAccessState('error');
      }
    }

    void checkAdminAccess();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredReports = useMemo(() => {
    if (statusFilter === 'ALL') {
      return reports;
    }

    return reports.filter((report) => report.status === statusFilter);
  }, [reports, statusFilter]);

  const pendingCount = reports.filter(
    (report) => report.status === 'PENDING_REVIEW',
  ).length;

  const validCount = reports.filter(
    (report) => report.status === 'RESOLVED_VALID',
  ).length;

  const invalidCount = reports.filter(
    (report) => report.status === 'RESOLVED_INVALID',
  ).length;

  function resolveReport(
    reportId: string,
    decision: 'VALID' | 'INVALID',
  ) {
    const selectedReport = reports.find(
      (report) => report.id === reportId,
    );

    if (!selectedReport) {
      return;
    }

    setReports((currentReports) =>
      currentReports.map((report) => {
        if (report.id !== reportId) {
          return report;
        }

        if (decision === 'VALID') {
          return {
            ...report,
            status: 'RESOLVED_VALID',
            listingStatus: 'DEACTIVATED',
          };
        }

        return {
          ...report,
          status: 'RESOLVED_INVALID',
          listingStatus: 'ACTIVE',
        };
      }),
    );

    if (decision === 'VALID') {
      setSuccessMessage(
        selectedReport.listingTitle +
          ' was marked valid and the listing is now deactivated in this frontend demo.',
      );
      return;
    }

    setSuccessMessage(
      selectedReport.listingTitle +
        ' was marked invalid and the listing remains active.',
    );
  }

  if (accessState === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  if (accessState === 'loading') {
    return (
      <section className="page-section">
        <div className="empty-state-card">
          <p className="eyebrow">Administrator Access</p>
          <h1>Checking permissions...</h1>
          <p>Please wait while your administrator role is verified.</p>
        </div>
      </section>
    );
  }

  if (accessState === 'forbidden') {
    return (
      <section className="page-section">
        <div className="empty-state-card">
          <p className="eyebrow">Access Denied</p>
          <h1>Administrator access is required.</h1>
          <p>
            Report details and moderation decisions are available only
            to administrators.
          </p>
          <Link className="primary-link narrow-link" to="/dashboard">
            Return to Dashboard
          </Link>
        </div>
      </section>
    );
  }

  if (accessState === 'error') {
    return (
      <section className="page-section">
        <div className="empty-state-card">
          <p className="eyebrow">Access Check Failed</p>
          <h1>We could not verify administrator access.</h1>
          <p>{accessError}</p>
          <Link className="primary-link narrow-link" to="/dashboard">
            Return to Dashboard
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Admin Moderation</p>
          <h1>Reported Listings</h1>
          <p className="page-description">
            Review member reports, determine whether each report is
            valid, and update the listing moderation status.
          </p>
          {adminName && (
            <p className="helper-text">
              Signed in as administrator: {adminName}
            </p>
          )}
        </div>

        <div className="page-header-actions">
          <Link className="secondary-link" to="/admin/listings">
            Admin Listings
          </Link>
          <Link className="secondary-link" to="/dashboard">
            Dashboard
          </Link>
        </div>
      </div>

      <div className="admin-report-summary-grid">
        <article className="summary-card">
          <strong className="summary-number">{reports.length}</strong>
          <span className="summary-label">Total Reports</span>
        </article>

        <article className="summary-card">
          <strong className="summary-number">{pendingCount}</strong>
          <span className="summary-label">Pending Review</span>
        </article>

        <article className="summary-card">
          <strong className="summary-number">{validCount}</strong>
          <span className="summary-label">Valid Reports</span>
        </article>

        <article className="summary-card">
          <strong className="summary-number">{invalidCount}</strong>
          <span className="summary-label">Invalid Reports</span>
        </article>
      </div>

      <section className="admin-report-filter-panel">
        <label htmlFor="admin-report-status-filter">
          Report Status
          <select
            id="admin-report-status-filter"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as ReportFilter)
            }
          >
            <option value="ALL">All Reports</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="RESOLVED_VALID">Resolved — Valid</option>
            <option value="RESOLVED_INVALID">
              Resolved — Invalid
            </option>
          </select>
        </label>
      </section>

      {successMessage && (
        <p
          className="form-success admin-report-success"
          role="status"
          aria-live="polite"
        >
          {successMessage}
        </p>
      )}

      <section className="table-card admin-report-table-card">
        <div className="admin-report-table-header">
          <div>
            <p className="eyebrow">Moderation Queue</p>
            <h2>Listing Reports</h2>
          </div>
          <strong>{filteredReports.length} shown</strong>
        </div>

        {filteredReports.length === 0 ? (
          <div className="empty-state-card">
            <h3>No reports match this filter.</h3>
            <p>Select another report status to continue.</p>
          </div>
        ) : (
          <div className="responsive-table-wrapper">
            <table className="invite-table admin-report-table">
              <thead>
                <tr>
                  <th>Listing</th>
                  <th>Owner</th>
                  <th>Reason</th>
                  <th>Reporter</th>
                  <th>Report Date</th>
                  <th>Comment</th>
                  <th>Listing Status</th>
                  <th>Report Status</th>
                  <th>Decision</th>
                </tr>
              </thead>

              <tbody>
                {filteredReports.map((report) => {
                  const isPending =
                    report.status === 'PENDING_REVIEW';

                  return (
                    <tr key={report.id}>
                      <td>
                        <Link to={'/tools/' + report.toolId}>
                          {report.listingTitle}
                        </Link>
                      </td>
                      <td>{report.ownerName}</td>
                      <td>{report.reason}</td>
                      <td>{report.reporterName}</td>
                      <td>{formatReportDate(report.reportedAt)}</td>
                      <td>
                        {report.comment ||
                          'No additional comment provided.'}
                      </td>
                      <td>
                        <span
                          className={
                            'admin-report-listing-status admin-report-listing-status-' +
                            report.listingStatus.toLowerCase()
                          }
                        >
                          {report.listingStatus === 'ACTIVE'
                            ? 'Active'
                            : 'Deactivated'}
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            'admin-report-status admin-report-status-' +
                            report.status.toLowerCase()
                          }
                        >
                          {formatReportStatus(report.status)}
                        </span>
                      </td>
                      <td>
                        {isPending ? (
                          <div className="admin-report-actions">
                            <button
                              type="button"
                              className="danger-button"
                              onClick={() =>
                                resolveReport(report.id, 'VALID')
                              }
                            >
                              Mark Valid
                            </button>

                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() =>
                                resolveReport(report.id, 'INVALID')
                              }
                            >
                              Mark Invalid
                            </button>
                          </div>
                        ) : (
                          <span className="helper-text">
                            Decision recorded
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <aside className="demo-note-card">
        <strong>Frontend-only moderation demonstration</strong>
        <p>
          Issue #54 report review, status changes, and access-control
          presentation are implemented in the frontend. The backend
          Report model, persistence, report-resolution endpoints,
          reservation cancellation, owner notifications, and audit-log
          persistence are not available yet.
        </p>
      </aside>
    </section>
  );
}

export default AdminReportsPage;
