import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  absolutePhotoUrl,
  ApiError,
  reservationsApi,
  toolsApi,
  type Reservation,
  type Tool,
} from '../api/client';
import { useAuth } from '../context/authContextValue';

/**
 * ReturnedToolsPage
 *
 * Concept shift from the R1 mock: "returned tools" is not a backend
 * resource. We build this page by:
 *   1. Fetching ``GET /reservations?state=RETURNED`` (both roles).
 *   2. For each reservation, fetching ``GET /tools/{tool_id}`` to get
 *      the tool details and owner summary.
 *   3. Linking each card to the original reservation's review page.
 */
function ReturnedToolsPage() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [toolsById, setToolsById] = useState<Record<string, Tool>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setErrorMessage('');
    (async () => {
      try {
        // Pull both borrower and owner views, then dedupe by id.
        const [asBorrower, asOwner] = await Promise.all([
          reservationsApi.list({ state: 'RETURNED', role: 'borrower' }),
          reservationsApi.list({ state: 'RETURNED', role: 'owner' }),
        ]);
        const seen = new Set<string>();
        const all: Reservation[] = [];
        for (const r of [...asBorrower.items, ...asOwner.items]) {
          if (!seen.has(r.id)) {
            seen.add(r.id);
            all.push(r);
          }
        }
        if (cancelled) return;
        setReservations(all);

        // Fetch the tools for each reservation in parallel.
        const toolEntries = await Promise.all(
          all.map(async (r) => {
            try {
              const tool = await toolsApi.get(r.tool_id);
              return [r.tool_id, tool] as const;
            } catch {
              return null;
            }
          }),
        );
        if (cancelled) return;
        const map: Record<string, Tool> = {};
        for (const entry of toolEntries) {
          if (entry) map[entry[0]] = entry[1];
        }
        setToolsById(map);
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError) setErrorMessage(err.message);
          else setErrorMessage('Failed to load returned tools.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Browse &amp; Search</p>
          <h1>Returned Tools</h1>
          <p className="page-description">
            View tools that have been returned and open the review workflow.
          </p>
        </div>
      </div>

      {isLoading ? (
        <p>Loading…</p>
      ) : errorMessage ? (
        <p className="error-message" role="alert">
          {errorMessage}
        </p>
      ) : reservations.length === 0 ? (
        <div className="empty-state-card">
          <p className="eyebrow">No Returned Tools</p>
          <h2>No reservations are returned yet.</h2>
          <p>Once a borrower marks a tool as returned, it will appear here.</p>
          <Link className="primary-link" to="/tools">
            Browse Tools
          </Link>
        </div>
      ) : (
        <div className="tool-grid">
          {reservations.map((reservation) => {
            const tool = toolsById[reservation.tool_id];
            const isBorrower = user?.id === reservation.borrower_id;
            // The other party is the one the current user reviews.
            const reviewTarget = isBorrower ? 'owner' : 'borrower';
            return (
              <article className="tool-card" key={reservation.id}>
                {tool?.photos[0] ? (
                  <img
                    src={absolutePhotoUrl(tool.photos[0].url)}
                    alt={tool?.name ?? 'Tool'}
                    className="tool-image"
                  />
                ) : (
                  <div className="tool-image tool-image-placeholder">
                    No photo
                  </div>
                )}

                <div className="tool-card-body">
                  <div className="tool-card-top">
                    <span className="status-badge">RETURNED</span>
                    <span className="rating">
                      Reviewing: {reviewTarget}
                    </span>
                  </div>

                  <h2>{tool?.name ?? `Tool #${reservation.tool_id.slice(0, 8)}`}</h2>
                  <p>{tool?.description ?? '—'}</p>

                  <dl className="tool-meta">
                    <div>
                      <dt>Owner</dt>
                      <dd>{tool?.owner.full_name ?? '—'}</dd>
                    </div>

                    <div>
                      <dt>Returned</dt>
                      <dd>
                        {reservation.returned_at
                          ? new Date(reservation.returned_at).toLocaleDateString()
                          : '—'}
                      </dd>
                    </div>
                  </dl>

                  <Link
                    className="primary-link"
                    to={`/reservations/${reservation.id}/review`}
                  >
                    Review This Reservation
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default ReturnedToolsPage;
