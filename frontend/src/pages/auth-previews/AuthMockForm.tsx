import { useState } from "react";

export type AuthMode = "login" | "register";

type AuthMockFormProps = {
  className?: string;
  defaultMode?: AuthMode;
};

/** Static mock — no API calls; for layout comparison only. */
export function AuthMockForm({
  className,
  defaultMode = "login",
}: AuthMockFormProps) {
  const [mode, setMode] = useState<AuthMode>(defaultMode);

  return (
    <div className={["ap-form-panel", className].filter(Boolean).join(" ")}>
      <div className="ap-tabs" role="tablist" aria-label="Auth mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          className={mode === "login" ? "ap-tabs__btn ap-tabs__btn--active" : "ap-tabs__btn"}
          onClick={() => setMode("login")}
        >
          Log in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "register"}
          className={
            mode === "register" ? "ap-tabs__btn ap-tabs__btn--active" : "ap-tabs__btn"
          }
          onClick={() => setMode("register")}
        >
          Sign up
        </button>
      </div>
      <h2 className="ap-form-title">{mode === "login" ? "Log in" : "Sign up"}</h2>
      <form
        className="ap-form"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        {mode === "register" && (
          <>
            <label>
              Email
              <input type="email" autoComplete="email" placeholder="you@example.com" />
            </label>
            <label>
              Username
              <input type="text" autoComplete="username" placeholder="demo" />
            </label>
          </>
        )}
        {mode === "login" && (
          <label>
            Email or username
            <input type="text" autoComplete="username" placeholder="demo" />
          </label>
        )}
        <label>
          Password
          <input type="password" autoComplete="current-password" placeholder="••••••••" />
        </label>
        <button type="submit" className="btn-primary" disabled>
          {mode === "login" ? "Log in (preview)" : "Sign up (preview)"}
        </button>
      </form>
      <p className="ap-form-note">Mock form — production pages are unchanged.</p>
    </div>
  );
}
