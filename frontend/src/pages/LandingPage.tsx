import { Link } from "react-router-dom";
import { ThemeToggle } from "../components/ThemeToggle";

export function LandingPage() {
  return (
    <div className="landing-page">
      <div className="landing-grid" aria-hidden />
      <header className="landing-topbar">
        <ThemeToggle />
        <nav className="landing-nav">
          <Link to="/login" className="btn-secondary">
            Log in
          </Link>
          <Link to="/register" className="btn-primary">
            Sign up
          </Link>
        </nav>
      </header>
      <div className="landing-body">
        <p className="landing-brand landing-anim landing-anim-delay-0">
          Finance Dashboard
        </p>
        <main className="landing-hero">
          <h1 className="landing-title landing-anim landing-anim-delay-1">
            Focus on the path, not the noise
          </h1>
          <p className="landing-lead landing-anim landing-anim-delay-2">
            A private workspace for accounts, categories, and cashflow reports —
            authenticate, set your profile, keep data on your instance.
          </p>
          <div className="landing-rule landing-anim landing-anim-delay-2" aria-hidden />
          <div className="landing-cta landing-anim landing-anim-delay-3">
            <Link to="/register" className="btn-primary">
              Get started
            </Link>
            <Link to="/login" className="btn-secondary">
              I already have an account
            </Link>
          </div>
        </main>
        <section className="landing-split landing-anim landing-anim-delay-3">
          <div>
            <h2 className="landing-subhead">What you get today</h2>
            <p>
              Auth and account settings, cash accounts with ledgers, nested
              categories, a dashboard with net-worth and cashflow KPIs, and
              statistics with history charts — all on your own stack.
            </p>
          </div>
          <div>
            <h2 className="landing-subhead">Roadmap</h2>
            <p>
              Holdings, FX consolidation, portfolio market data, and Polish tax
              tooling land step by step from the product checklist.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
