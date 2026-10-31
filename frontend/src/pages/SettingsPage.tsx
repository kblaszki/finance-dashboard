import { useCallback, useEffect, useState } from "react";
import {
  fetchAppConfig,
  updateAppConfig,
} from "../api/appConfigApi";
import { updateEmail, updatePassword, updateProfile } from "../api/authApi";
import { PageHeader } from "../components/ui/PageHeader";
import { useAsyncData } from "../hooks/useAsyncData";
import { useAuth } from "../state/auth";
import { useTheme, type Theme } from "../state/theme";

const APPEARANCE_OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();

  const loadConfig = useCallback(() => fetchAppConfig(), []);
  const {
    data: appConfig,
    error: configError,
    loading: configLoading,
    reload: reloadConfig,
  } = useAsyncData(loadConfig);
  const [marketBusy, setMarketBusy] = useState(false);
  const [marketErr, setMarketErr] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [passwordErr, setPasswordErr] = useState<string | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setEmail(user.email);
    }
  }, [user]);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg(null);
    setProfileErr(null);
    setProfileBusy(true);
    try {
      await updateProfile(username);
      await refreshUser();
      setProfileMsg("Username updated.");
    } catch (err) {
      setProfileErr(err instanceof Error ? err.message : "Update failed");
    } finally {
      setProfileBusy(false);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailMsg(null);
    setEmailErr(null);
    setEmailBusy(true);
    try {
      await updateEmail(email, emailPassword);
      await refreshUser();
      setEmailMsg("Email updated.");
      setEmailPassword("");
    } catch (err) {
      setEmailErr(err instanceof Error ? err.message : "Update failed");
    } finally {
      setEmailBusy(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMsg(null);
    setPasswordErr(null);
    setPasswordBusy(true);
    try {
      await updatePassword(currentPassword, newPassword);
      setPasswordMsg("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPasswordErr(err instanceof Error ? err.message : "Update failed");
    } finally {
      setPasswordBusy(false);
    }
  }

  async function handleMarketLiveToggle(next: boolean) {
    setMarketErr(null);
    setMarketBusy(true);
    try {
      await updateAppConfig({ marketLiveApi: next });
      reloadConfig();
    } catch (err) {
      setMarketErr(
        err instanceof Error ? err.message : "Could not update market API setting",
      );
    } finally {
      setMarketBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Account settings"
        subtitle="Profile, email, password, appearance, and market data for this instance."
      />

      <section className="card form-section-gap">
        <h2 className="section-title">Market data</h2>
        <p className="muted">
          When off, watchlist quotes and chart history use the database only
          (no Twelve Data / Oanor / Yahoo from the app). CLI sync scripts still
          work.
        </p>
        {configLoading && !appConfig && (
          <p className="muted" role="status">
            Loading…
          </p>
        )}
        {(configError || marketErr) && (
          <p className="error-banner" role="alert">
            {marketErr ?? configError}
          </p>
        )}
        {appConfig && (
          <label className="appearance-option">
            <input
              type="checkbox"
              checked={appConfig.marketLiveApi}
              disabled={marketBusy}
              onChange={(e) => void handleMarketLiveToggle(e.target.checked)}
            />
            Allow live market API fetches
          </label>
        )}
      </section>

      <section className="card form-section-gap">
        <h2 className="section-title">Appearance</h2>
        <div className="appearance-options" role="radiogroup" aria-label="Color theme">
          {APPEARANCE_OPTIONS.map((option) => (
            <label key={option.value} className="appearance-option">
              <input
                type="radio"
                name="theme-preference"
                value={option.value}
                checked={theme === option.value}
                onChange={() => setTheme(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </section>

      <section className="card form-section-gap">
        <h2 className="section-title">Profile</h2>
        <form className="auth-form" onSubmit={handleProfileSubmit}>
          <label>
            Username
            <input
              type="text"
              autoComplete="username"
              required
              minLength={3}
              maxLength={32}
              pattern="[A-Za-z0-9_]+"
              value={username}
              aria-invalid={profileErr ? true : undefined}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          {profileErr && <p className="auth-error">{profileErr}</p>}
          {profileMsg && <p className="success-banner">{profileMsg}</p>}
          <button type="submit" className="btn-primary" disabled={profileBusy}>
            {profileBusy ? "Saving…" : "Save username"}
          </button>
        </form>
      </section>

      <section className="card form-section-gap">
        <h2 className="section-title">Email</h2>
        <form className="auth-form" onSubmit={handleEmailSubmit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Current password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={emailPassword}
              aria-invalid={emailErr ? true : undefined}
              onChange={(e) => setEmailPassword(e.target.value)}
            />
          </label>
          {emailErr && <p className="auth-error">{emailErr}</p>}
          {emailMsg && <p className="success-banner">{emailMsg}</p>}
          <button type="submit" className="btn-primary" disabled={emailBusy}>
            {emailBusy ? "Saving…" : "Save email"}
          </button>
        </form>
      </section>

      <section className="card form-section-gap">
        <h2 className="section-title">Security</h2>
        <form className="auth-form" onSubmit={handlePasswordSubmit}>
          <label>
            Current password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>
          <label>
            New password (min. 8 characters)
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={newPassword}
              aria-invalid={passwordErr ? true : undefined}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </label>
          {passwordErr && <p className="auth-error">{passwordErr}</p>}
          {passwordMsg && <p className="success-banner">{passwordMsg}</p>}
          <button type="submit" className="btn-primary" disabled={passwordBusy}>
            {passwordBusy ? "Saving…" : "Change password"}
          </button>
        </form>
      </section>
    </>
  );
}
