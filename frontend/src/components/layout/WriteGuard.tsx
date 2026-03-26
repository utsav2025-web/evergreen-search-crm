import React from "react";
import { useAuthStore } from "@/store/authStore";

interface WriteGuardProps {
  children: React.ReactElement;
  /** Override tooltip text */
  tooltip?: string;
  /** If true, hide the element entirely instead of disabling */
  hide?: boolean;
}

/**
 * Wraps any interactive element (button, input, etc.) and disables it
 * with a tooltip when the current user is a guest.
 */
export default function WriteGuard({
  children,
  tooltip = "Read-only in guest mode",
  hide = false,
}: WriteGuardProps) {
  const { isGuest } = useAuthStore();

  if (!isGuest) return children;
  if (hide) return null;

  return (
    <span
      title={tooltip}
      className="cursor-not-allowed inline-flex"
      aria-label={tooltip}
    >
      {React.cloneElement(children, {
        disabled: true,
        onClick: undefined,
        onChange: undefined,
        className: `${children.props.className ?? ""} opacity-40 pointer-events-none`,
        "aria-disabled": true,
      })}
    </span>
  );
}
