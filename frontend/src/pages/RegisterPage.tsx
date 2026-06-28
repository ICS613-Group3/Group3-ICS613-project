function RegisterPage() {
  return (
    <section className="page-card">
      <p className="eyebrow">Invite Only</p>
      <h2>Register with Invite Token</h2>
      <p>
        Placeholder registration page for new members joining with an admin-issued invite token.
      </p>

      <form className="form-grid">
        <label>
          Invite Token
          <input type="text" placeholder="Enter invite token" />
        </label>

        <label>
          Display Name
          <input type="text" placeholder="Your display name" />
        </label>

        <label>
          Email
          <input type="email" placeholder="member@example.com" />
        </label>

        <label>
          Password
          <input type="password" placeholder="Create password" />
        </label>

        <button type="button">Create Account</button>
      </form>
    </section>
  );
}

export default RegisterPage;
