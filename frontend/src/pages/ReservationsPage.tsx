import { Link } from 'react-router-dom';

const sampleReservations = [
  {
    id: 'reservation-1',
    toolName: 'Cordless Drill',
    role: 'Borrower',
    status: 'REQUESTED',
    dates: 'July 1 - July 3',
  },
  {
    id: 'reservation-2',
    toolName: 'Step Ladder',
    role: 'Owner',
    status: 'APPROVED',
    dates: 'July 5 - July 6',
  },
];

function ReservationsPage() {
  return (
    <section className="page-stack">
      <div className="page-card">
        <p className="eyebrow">Reservation Lifecycle</p>
        <h2>Reservations</h2>
        <p>
          Placeholder dashboard for borrower and owner reservation workflows using REQUESTED,
          APPROVED, DENIED, CANCELLED, PICKED_UP, and RETURNED statuses.
        </p>
      </div>

      <div className="card-grid">
        {sampleReservations.map((reservation) => (
          <article className="info-card" key={reservation.id}>
            <h3>{reservation.toolName}</h3>
            <p>Role: {reservation.role}</p>
            <p>Dates: {reservation.dates}</p>
            <span className="status-badge">{reservation.status}</span>
            <Link className="button-link" to={`/reservations/${reservation.id}`}>
              View Reservation
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

export default ReservationsPage;
