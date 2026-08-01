import { Navigate, useParams } from "react-router-dom";
import { AuthMockForm } from "./AuthMockForm";
import { AuthPreviewChrome } from "./AuthPreviewChrome";
import "./auth-previews.css";

const SLUGS = [
  "signal-card",
  "hatch-split-auth",
  "hatch-folio-auth",
  "grid-room-auth",
  "mesh-stage-auth",
  "ledge-auth",
] as const;
type Slug = (typeof SLUGS)[number];

function isSlug(value: string | undefined): value is Slug {
  return value != null && (SLUGS as readonly string[]).includes(value);
}

export function AuthPreviewPage() {
  const { slug } = useParams();
  if (!isSlug(slug)) {
    return <Navigate to="/preview/auth" replace />;
  }

  switch (slug) {
    case "signal-card":
      return <SignalCardPreview />;
    case "hatch-split-auth":
      return <HatchSplitAuthPreview />;
    case "hatch-folio-auth":
      return <HatchFolioAuthPreview />;
    case "grid-room-auth":
      return <GridRoomAuthPreview />;
    case "mesh-stage-auth":
      return <MeshStageAuthPreview />;
    case "ledge-auth":
      return <LedgeAuthPreview />;
  }
}

function BrandCopy() {
  return (
    <>
      <p className="ap-brand">Finance Dashboard</p>
      <h1 className="ap-headline">Your private ledger</h1>
      <p className="ap-lead">
        Sign in to manage your account. Portfolio tools arrive from the roadmap —
        this preview is layout only.
      </p>
      <div className="ap-rule" aria-hidden />
    </>
  );
}

function SignalCardPreview() {
  return (
    <AuthPreviewChrome name="Signal card">
      <div className="ap-shell ap-shell--signal">
        <AuthMockForm className="ap-form-panel--card" />
      </div>
    </AuthPreviewChrome>
  );
}

function HatchSplitAuthPreview() {
  return (
    <AuthPreviewChrome name="Hatch split">
      <div className="ap-shell ap-shell--hatch-split">
        <div className="ap-atmos ap-atmos--hatch" aria-hidden />
        <section className="ap-split-copy">
          <BrandCopy />
        </section>
        <section className="ap-split-form">
          <AuthMockForm />
        </section>
      </div>
    </AuthPreviewChrome>
  );
}

function HatchFolioAuthPreview() {
  return (
    <AuthPreviewChrome name="Hatch folio">
      <div className="ap-shell ap-shell--hatch-folio">
        <div className="ap-atmos ap-atmos--hatch" aria-hidden />
        <aside className="ap-folio-mast">
          <BrandCopy />
          <p className="ap-mast-note">
            Same shell language as the authenticated hatch folio — for guests.
          </p>
        </aside>
        <main className="ap-folio-page">
          <AuthMockForm />
        </main>
      </div>
    </AuthPreviewChrome>
  );
}

function GridRoomAuthPreview() {
  return (
    <AuthPreviewChrome name="Grid room">
      <div className="ap-shell ap-shell--grid-room">
        <div className="ap-atmos ap-atmos--grid" aria-hidden />
        <div className="ap-float">
          <p className="ap-brand ap-brand--center">Finance Dashboard</p>
          <AuthMockForm />
        </div>
      </div>
    </AuthPreviewChrome>
  );
}

function MeshStageAuthPreview() {
  return (
    <AuthPreviewChrome name="Mesh stage">
      <div className="ap-shell ap-shell--mesh-stage">
        <div className="ap-atmos ap-atmos--mesh" aria-hidden />
        <div className="ap-atmos ap-atmos--horizon" aria-hidden />
        <header className="ap-stage-top">
          <p className="ap-brand">Finance Dashboard</p>
        </header>
        <main className="ap-stage-card">
          <p className="ap-lead ap-lead--tight">
            Soft light under a raised form — depth without a busy dashboard.
          </p>
          <AuthMockForm />
        </main>
      </div>
    </AuthPreviewChrome>
  );
}

function LedgeAuthPreview() {
  return (
    <AuthPreviewChrome name="Ledge">
      <div className="ap-shell ap-shell--ledge">
        <div className="ap-atmos ap-atmos--hatch" aria-hidden />
        <header className="ap-ledge">
          <BrandCopy />
        </header>
        <section className="ap-ledge-band">
          <AuthMockForm className="ap-form-panel--wide" />
        </section>
      </div>
    </AuthPreviewChrome>
  );
}
