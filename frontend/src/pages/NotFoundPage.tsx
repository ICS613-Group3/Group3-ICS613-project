import { Link } from 'react-router-dom';

function NotFoundPage() {
  return (
    <section className="page-card">
      <p className="eyebrow">404</p>
      <h2>Page Not Found</h2>
      <p>The page you are looking for does not exist.</p>
      <Link className="button-link" to="/dashboard">
        Back to Dashboard
      </Link>
    </section>
  );
}

export default NotFoundPage;
