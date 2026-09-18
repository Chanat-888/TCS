import Link from "next/link";
import { BrandMark } from "./icons/BrandMark";

export function Brand({
  href = "/browse",
  size = 30,
  wordSize = 18,
  wordColor = "var(--white)",
}: {
  href?: string;
  size?: number;
  wordSize?: number;
  wordColor?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-[9px] no-underline flex-shrink-0"
      aria-label="TCS — หน้าแรก"
    >
      <BrandMark size={size} />
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: wordSize,
          color: wordColor,
        }}
      >
        TCS
      </span>
    </Link>
  );
}
