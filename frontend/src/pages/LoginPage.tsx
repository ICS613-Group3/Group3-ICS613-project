function LoginPage() {
  return (
    <section className="page-card">
      <p className="eyebrow">Member Access</p>
      <h2>Login</h2>
      <p>
        Placeholder login page for members to securely access the invite-only tool sharing
        platform.
      </p>

      <form className="form-grid">
        <label>
          Email
          <input type="email" placeholder="member@example.com" />
        </label>

        <label>
          Password
          <input type="password" placeholder="Enter password" />
        </label>

        <button type="button">Login</button>
      </form>
    </section>
  );
}

export default LoginPage;
