import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { FiBell, FiCheck, FiTrash2 } from "react-icons/fi";

type NotificationType = "success" | "error" | "info" | "warning";

export type NotificationInput = {
  title: string;
  message: string;
  type?: NotificationType;
};

type Notification = NotificationInput & {
  id: string;
  createdAt: number;
  read: boolean;
};

type NotificationsContextValue = {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (input: NotificationInput) => void;
  markAllRead: () => void;
  dismissNotification: (id: string) => void;
  clearAll: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null
);

function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((input: NotificationInput) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const next: Notification = {
      id,
      createdAt: Date.now(),
      read: false,
      type: input.type ?? "info",
      title: input.title,
      message: input.message,
    };
    setNotifications((prev) => [next, ...prev].slice(0, 50));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) =>
      prev.map((item) => (item.read ? item : { ...item, read: true }))
    );
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications]
  );

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      addNotification,
      markAllRead,
      dismissNotification,
      clearAll,
    }),
    [
      notifications,
      unreadCount,
      addNotification,
      markAllRead,
      dismissNotification,
      clearAll,
    ]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return context;
}

function NotificationsBell() {
  const {
    notifications,
    unreadCount,
    markAllRead,
    dismissNotification,
    clearAll,
  } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!panelRef.current) return;
      if (panelRef.current.contains(event.target as Node)) return;
      setOpen(false);
    };
    if (open) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="admin-notifications" ref={panelRef}>
      <button
        type="button"
        className="admin-icon-button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Notifications"
        aria-expanded={open}
      >
        {unreadCount > 0 && <span className="admin-icon-button__dot" />}
        <FiBell size={18} aria-hidden="true" />
      </button>
      {open && (
        <div className="admin-notifications__panel" role="dialog">
          <div className="admin-notifications__header">
            <div>
              <p className="admin-notifications__title">Notifications</p>
              <span className="admin-notifications__meta">
                {unreadCount} unread
              </span>
            </div>
            <div className="admin-notifications__actions">
              <button
                type="button"
                className="admin-notifications__action"
                onClick={markAllRead}
              >
                <FiCheck size={14} aria-hidden="true" /> Mark read
              </button>
              <button
                type="button"
                className="admin-notifications__action"
                onClick={clearAll}
              >
                <FiTrash2 size={14} aria-hidden="true" /> Clear
              </button>
            </div>
          </div>
          <div className="admin-notifications__list">
            {notifications.length ? (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className={`admin-notifications__item admin-notifications__item--${item.type}${
                    item.read ? " is-read" : ""
                  }`}
                >
                  <div>
                    <p className="admin-notifications__item-title">
                      {item.title}
                    </p>
                    <p className="admin-notifications__item-message">
                      {item.message}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="admin-notifications__dismiss"
                    onClick={() => dismissNotification(item.id)}
                    aria-label="Dismiss notification"
                  >
                    ×
                  </button>
                </div>
              ))
            ) : (
              <p className="admin-notifications__empty">No notifications yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { NotificationsBell, NotificationsProvider, useNotifications };
