import Link from "next/link";
import { formatTHB } from "@/lib/format";
import type { Profile, WantedPost } from "@/lib/supabase/types";

const CATEGORY_LABEL: Record<WantedPost["category"], string> = {
  new: "บูสเตอร์ใหม่",
  deck: "เด็คพร้อมเล่น",
  rare: "การ์ดหายาก",
};

export function WantedPostCard({
  post,
  poster,
  /** Owner's-own-profile variant: link to the reply inbox instead of a contact button. */
  posterThreadsHref,
}: {
  post: WantedPost;
  poster?: Pick<Profile, "display_name">;
  posterThreadsHref?: string;
}) {
  return (
    <div
      className="flex flex-col gap-3 rounded-[14px] p-[14px]"
      style={{ background: "var(--panel)", border: "1px solid rgba(140, 147, 163, 0.12)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="mono rounded-full px-2 py-[3px] text-[10.5px]"
          style={{ color: "var(--cyan)", background: "rgba(95, 212, 255, 0.1)", border: "1px solid rgba(95, 212, 255, 0.28)" }}
        >
          กำลังหา
        </span>
        <span className="mono rounded-md px-[6px] py-[2px] text-[10px]" style={{ color: "var(--blue-dim)", background: "rgba(47, 143, 232, 0.12)" }}>
          {CATEGORY_LABEL[post.category]}
        </span>
      </div>

      <div>
        <p className="text-[13.5px] font-medium leading-snug" style={{ color: "var(--white)" }}>
          {post.name}
        </p>
        <p className="mt-[3px] text-[12px]" style={{ color: "var(--steel)" }}>
          {post.set_name}
        </p>
      </div>

      {post.note && (
        <p
          className="text-[12px] leading-relaxed overflow-hidden"
          style={{ color: "var(--steel)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
        >
          {post.note}
        </p>
      )}

      <div className="flex items-baseline justify-between">
        <span className="mono text-[15px]" style={{ color: "var(--white)" }}>
          {formatTHB(post.max_price)}
        </span>
        <span className="text-[10.5px]" style={{ color: "var(--steel-dim)" }}>
          งบสูงสุด
        </span>
      </div>

      {posterThreadsHref ? (
        <Link
          href={posterThreadsHref}
          className="mt-1 flex h-[38px] items-center justify-center rounded-[10px] text-[12.5px] font-medium no-underline"
          style={{ background: "var(--panel-2)", border: "1px solid rgba(140,147,163,0.2)", color: "var(--steel)" }}
        >
          ข้อความที่ได้รับ
        </Link>
      ) : (
        <>
          {poster && (
            <div
              className="flex min-w-0 items-center gap-[6px] pt-2 text-[11.5px]"
              style={{ borderTop: "1px solid rgba(140, 147, 163, 0.1)", color: "var(--steel)" }}
            >
              <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{poster.display_name} กำลังหา</span>
            </div>
          )}
          <Link
            href={`/wanted/${post.id}/chat`}
            className="flex h-[38px] items-center justify-center rounded-[10px] text-[12.5px] font-medium no-underline"
            style={{ background: "var(--blue)", color: "#071523" }}
          >
            ฉันมีการ์ดนี้
          </Link>
        </>
      )}
    </div>
  );
}
