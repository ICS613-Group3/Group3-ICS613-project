import { useParams } from 'react-router-dom';

function ReservationDetailPage() {
  const { reservationId } = useParams();

  return (
    <section className="page-card">
      <p className="eyebrow">Reservation Detail</p>
      <h2>Reservation Workflow</h2>
      <p>
        Placeholder details for reservation ID: <strong>{reservationId}</strong>
      </p>

      <div className="workflow-row">
        <span className="status-badge">REQUESTED</span>
        <span className="status-badge">APPROVED</span>
        <span className="status-badge">PICKED_UP</span>
        <span className="status-badge">RETURNED</span>
      </div>

      <div className="action-row">
        <button type="button">Owner Approve</button>
        <button type="button">Owner Deny</button>
        <button type="button">Borrower Cancel</button>
        <button type="button">Confirm Pickup</button>
        <button type="button">Confirm Return</button>
      </div>

      <p className="helper-text">
        These buttons are placeholders. Later, they will appear only when the logged-in user role
        and reservation status allow the action.
      </p>
    </section>
  );
}

export default ReservationDetailPage;
