import { Link, useParams } from 'react-router-dom';

function ToolDetailPage() {
  const { toolId } = useParams();

  return (
    <section className="page-card">
      <p className="eyebrow">Tool Details</p>
      <h2>Tool Detail Page</h2>
      <p>
        Placeholder details for tool ID: <strong>{toolId}</strong>
      </p>

      <div className="detail-grid">
        <div className="tool-photo-large">Photo Gallery Placeholder</div>

        <div>
          <h3>Cordless Drill</h3>
          <p>Category: Power Tools</p>
          <p>Condition: Good</p>
          <p>Owner: Demo Owner</p>
          <p>Latest return time: 21:30 HST</p>
          <p>
            This page will show photos, lending rules, borrower notes, availability, owner profile
            information, and the reservation request entry point.
          </p>

          <Link className="button-link" to="/reservations">
            Request Reservation
          </Link>
        </div>
      </div>
    </section>
  );
}

export default ToolDetailPage;
