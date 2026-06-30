import { Link } from "react-router-dom";

const FEATURES = [
  {
    title: "Net worth dashboard",
    body: "Track total wealth with a five-segment breakdown across cash, stocks, crypto, metals, and real estate.",
  },
  {
    title: "Accounts & portfolio",
    body: "Register bank, brokerage, and manual accounts. View holdings and trade history in one place.",
  },
  {
    title: "Cashflow & budgets",
    body: "Record income and expenses, analyze spending by category, and monitor monthly trends.",
  },
  {
    title: "Polish tax reporting",
    body: "Generate PIT-38 capital gains reports with FIFO matching and export results for filing.",
  },
];

export function LandingPage() {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <h1 className="landing-logo">Finance Dashboard</h1>
        <nav className="landing-nav">
          <Link to="/login" className="btn-secondary">
            Log in
          </Link>
          <Link to="/register" className="btn-primary">
            Sign up
          </Link>
        </nav>
      </header>
      <main className="landing-main">
        <section className="landing-hero card">
          <h2 className="landing-title">Personal finance, under your control</h2>
          <p className="landing-lead">
            Manage bank and brokerage accounts, track every asset class, and prepare Polish tax
            reports — with your data isolated and private.
          </p>
          <div className="landing-cta">
            <Link to="/register" className="btn-primary">
              Get started
            </Link>
            <Link to="/login" className="btn-secondary">
              I already have an account
            </Link>
          </div>
        </section>
        <section className="landing-features">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="landing-feature card">
              <h3>{feature.title}</h3>
              <p className="muted">{feature.body}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
