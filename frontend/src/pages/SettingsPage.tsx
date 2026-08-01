import { useEffect, useState } from "react";
import { useAuth } from "../state/auth";
import { updateEmail, updatePassword, updateProfile } from "../api/authApi";

export function SettingsPage() {
  const { user, refreshUser } = useAuth();

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

  return (
    <div className="page-stack">
      <h1 className="page-title">Account settings</h1>

      <section className="card form-section-gap">
        <h2 className="section-title">Profile</h2>
        <form className="auth-form" onSubmit={handleProfileSubmit}>
          <label>
            Username
            <input
              type="text"
              required
              minLength={3}
              maxLength={32}
              pattern="[A-Za-z0-9_]+"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          {profileErr && <p className="auth-error">{profileErr}</p>}
          {profileMsg && <p className="muted">{profileMsg}</p>}
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
              onChange={(e) => setEmailPassword(e.target.value)}
            />
          </label>
          {emailErr && <p className="auth-error">{emailErr}</p>}
          {emailMsg && <p className="muted">{emailMsg}</p>}
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
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </label>
          {passwordErr && <p className="auth-error">{passwordErr}</p>}
          {passwordMsg && <p className="muted">{passwordMsg}</p>}
          <button type="submit" className="btn-primary" disabled={passwordBusy}>
            {passwordBusy ? "Saving…" : "Change password"}
          </button>
        </form>
      </section>
    </div>
  );
}
