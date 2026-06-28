import { NavLink, Outlet } from 'react-router-dom';

function AppLayout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">ICS 613 Group 3</p>
          <h1>Neighborhood Tool Sharing</h1>
        </div>

        <nav className="app-nav">
          <NavLink className="nav-link" to="/dashboard">Dashboard</NavLink>
          <NavLink className="nav-link" to="/tools">Browse Tools</NavLink>
          <NavLink className="nav-link" to="/reservations">Reservations</NavLink>
          <NavLink className="nav-link" to="/login">Login</NavLink>
          <NavLink className="nav-link" to="/register">Register</NavLink>
        </nav>
      </header>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;
