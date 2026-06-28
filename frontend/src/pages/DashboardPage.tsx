function DashboardPage() {
  return (
    <section className="page-stack">
      <div className="page-card">
        <p className="eyebrow">R1 Workflow</p>
        <h2>Member Dashboard</h2>
        <p>
          This dashboard will show a member&apos;s listed tools, incoming requests, outgoing
          reservations, notifications, and current reservation statuses.
        </p>
      </div>

      <div className="card-grid">
        <article className="info-card">
          <h3>My Tools</h3>
          <p>Owner view for tool listings and incoming reservation requests.</p>
        </article>

        <article className="info-card">
          <h3>My Reservations</h3>
          <p>Borrower view for requested, approved, picked up, and returned tools.</p>
        </article>

        <article className="info-card">
          <h3>Notifications</h3>
          <p>Status updates for reservation requests, approvals, pickup, and return.</p>
        </article>
      </div>
    </section>
  );
}

export default DashboardPage;
