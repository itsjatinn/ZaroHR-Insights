import { forwardRef } from "react";
import type { AnchorHTMLAttributes } from "react";
import { cn } from "./lib/utils";

interface NavLinkCompatProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "href"> {
  to: string;
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
  isActive?: boolean;
  isPending?: boolean;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  (
    {
      className,
      activeClassName,
      pendingClassName,
      to,
      isActive,
      isPending,
      ...props
    },
    ref,
  ) => {
    const resolvedActive =
      isActive ??
      (typeof window !== "undefined" ? window.location.pathname === to : false);

    return (
      <a
        ref={ref}
        href={to}
        className={cn(
          className,
          resolvedActive && activeClassName,
          isPending && pendingClassName,
        )}
        aria-current={resolvedActive ? "page" : undefined}
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
