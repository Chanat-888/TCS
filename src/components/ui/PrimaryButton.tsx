"use client";

import { ButtonHTMLAttributes } from "react";

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: "primary" | "danger";
  height?: number;
}

const VARIANT_STYLES: Record<string, { bg: string; hoverBg: string; ink: string; ringInk: string }> = {
  primary: { bg: "var(--blue)", hoverBg: "#4aa0ef", ink: "#071523", ringInk: "rgba(7,21,35,0.35)" },
  danger: { bg: "var(--danger)", hoverBg: "var(--danger)", ink: "#2a0d08", ringInk: "rgba(42,13,8,0.35)" },
};

/** Loading state: label fades out, a small spinner fades in — per DESIGN.md's primary-button loading pattern. */
export function PrimaryButton({
  loading = false,
  variant = "primary",
  height = 50,
  disabled,
  className = "",
  style,
  children,
  ...rest
}: PrimaryButtonProps) {
  const v = VARIANT_STYLES[variant];
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`w-full rounded-[11px] border-0 font-semibold text-[15px] cursor-pointer transition-[background,opacity] duration-150 relative disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
      style={{
        height,
        background: variant === "danger" ? v.bg : undefined,
        backgroundColor: variant === "primary" ? v.bg : undefined,
        color: loading ? "transparent" : v.ink,
        opacity: variant === "danger" && !disabled && !loading ? undefined : undefined,
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !loading) (e.currentTarget as HTMLElement).style.background = v.hoverBg;
      }}
      onMouseLeave={(e) => {
        if (!disabled && !loading) (e.currentTarget as HTMLElement).style.background = v.bg;
      }}
    >
      {children}
      {loading && (
        <span
          className="absolute top-1/2 left-1/2 rounded-full animate-spin"
          style={{
            width: 18,
            height: 18,
            marginTop: -9,
            marginLeft: -9,
            border: `2px solid ${v.ringInk}`,
            borderTopColor: v.ink,
          }}
          aria-hidden="true"
        />
      )}
    </button>
  );
}
