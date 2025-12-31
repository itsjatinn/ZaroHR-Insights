import { useEffect, useRef, useState } from "react";
import { FiChevronDown, FiLogOut } from "react-icons/fi";

interface AdminProfileMenuProps {
  displayName: string;
  initial: string;
  onSignOut?: () => void;
}

function AdminProfileMenu({
  displayName,
  initial,
  onSignOut,
}: AdminProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target as Node)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="admin-profile-menu" ref={containerRef}>
      <button
        type="button"
        className="admin-profile"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="admin-profile__avatar">{initial}</span>
        <span>{displayName}</span>
        <span className="admin-profile__chevron" aria-hidden="true">
          <FiChevronDown size={16} />
        </span>
      </button>
      {open ? (
        <div className="admin-profile__dropdown" role="menu">
          <button
            type="button"
            className="admin-profile__item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut?.();
            }}
          >
            <FiLogOut size={16} aria-hidden="true" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

export { AdminProfileMenu };
