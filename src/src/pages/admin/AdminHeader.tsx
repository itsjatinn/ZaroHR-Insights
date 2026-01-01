import type { ReactNode } from "react";
import { cn } from "./lib/utils";

interface AdminHeaderProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

function AdminHeader({ title, subtitle, actions }: AdminHeaderProps) {
  const hasTitle = Boolean(title);
  return (
    <header className={cn("admin-header", !hasTitle && "admin-header--tools")}>
      {hasTitle ? (
        <div className="admin-header__meta">
          <h1>{title}</h1>
          {subtitle ? <p className="admin-header__subtitle">{subtitle}</p> : null}
        </div>
      ) : null}
      {actions ? <div className="admin-header__actions">{actions}</div> : null}
    </header>
  );
}

export { AdminHeader };
