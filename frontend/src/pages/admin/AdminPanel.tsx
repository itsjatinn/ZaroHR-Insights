import type { ReactNode } from "react";

interface AdminPanelProps {
  title: string;
  description?: string;
  children: ReactNode;
}

function AdminPanel({ title, description, children }: AdminPanelProps) {
  return (
    <section className="admin-panel">
      <div className="admin-panel__header">
        <div>
          <h2>{title}</h2>
          {description ? (
            <p className="admin-panel__description">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="admin-panel__body">{children}</div>
    </section>
  );
}

export { AdminPanel };
