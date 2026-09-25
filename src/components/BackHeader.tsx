import Link from "next/link";
import type { ReactNode } from "react";

export function BackHeader({
  href,
  title,
  subtitle,
  right,
}: {
  href: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: "rgba(10, 12, 16, 0.78)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
    >
      <div className="wrap grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-[10px]">
        <div className="flex justify-start">
          <Link
            href={href}
            className="group inline-flex h-11 items-center gap-[4px] rounded-full pl-[10px] pr-[14px] text-[13.5px] font-medium no-underline transition-colors hover:text-[var(--cyan)]"
            style={{ color: "var(--white)" }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
              className="transition-transform motion-safe:group-hover:-translate-x-[3px]"
              style={{ color: "var(--cyan)" }}
            >
              <path d="M12.5 4 L6 10 L12.5 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            กลับ
          </Link>
        </div>

        <div className="min-w-0 max-w-[46vw] text-center">
          <p
            className="overflow-hidden text-ellipsis whitespace-nowrap"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15.5, color: "var(--white)" }}
          >
            {title}
          </p>
          {subtitle && (
            <p className="mono overflow-hidden text-ellipsis whitespace-nowrap text-[11px]" style={{ color: "var(--steel)" }}>
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex justify-end">{right}</div>
      </div>
      <div
        aria-hidden="true"
        className="h-px"
        style={{ background: "linear-gradient(90deg, transparent, var(--cyan-line) 50%, transparent)" }}
      />
    </header>
  );
}
