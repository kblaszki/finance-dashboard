import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { ThemeToggle } from "../../components/ThemeToggle";

type AuthPreviewChromeProps = {
  name: string;
  children: ReactNode;
};

export function AuthPreviewChrome({ name, children }: AuthPreviewChromeProps) {
  return (
    <div className="ap-chrome">
      <div className="ap-chrome__bar">
        <p className="ap-chrome__label">
          Preview: <strong>{name}</strong>
          {" · "}
          <Link to="/preview/auth">Back to gallery</Link>
        </p>
        <div className="ap-chrome__actions">
          <ThemeToggle />
        </div>
      </div>
      {children}
    </div>
  );
}
