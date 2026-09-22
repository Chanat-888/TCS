import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireVerifiedUserId } from "@/lib/session";
import { getWantedPostById, getWantedPostThreads } from "@/lib/wantedPosts";
import { formatRelativeTime } from "@/lib/format";
import { BackHeader } from "@/components/BackHeader";
import { Footer } from "@/components/Footer";

export default async function WantedPostThreadsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireVerifiedUserId();

  const post = await getWantedPostById(id);
  if (!post) notFound();
  if (post.poster_id !== userId) redirect(`/wanted/${id}/chat`);

  const threads = await getWantedPostThreads(id);

  return (
    <div style={{ "--wrap-max": "680px" } as CSSProperties}>
      <BackHeader href="/profile" title={post.name} subtitle="ข้อความที่ได้รับ" />
      <main className="py-7 pb-[70px]">
        <div className="wrap">
          {threads.length === 0 ? (
            <p className="py-[40px] text-center text-[13.5px]" style={{ color: "var(--steel)" }}>
              ยังไม่มีใครทักมา
            </p>
          ) : (
            <div className="flex flex-col gap-[10px]">
              {threads.map((t) => (
                <Link
                  key={t.responder.id}
                  href={`/wanted/${id}/threads/${t.responder.id}`}
                  className="flex items-center gap-3 rounded-2xl p-4 no-underline text-inherit transition-colors hover:bg-[rgba(140,147,163,0.06)]"
                  style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}
                >
                  <div
                    className="flex flex-shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
                    style={{ width: 36, height: 36, background: "var(--panel-2)", color: "var(--cyan)", fontFamily: "var(--font-display)" }}
                  >
                    {t.responder.avatar_initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium" style={{ color: "var(--white)" }}>
                      {t.responder.display_name}
                    </p>
                    <p className="overflow-hidden text-ellipsis whitespace-nowrap text-[12px]" style={{ color: "var(--steel)" }}>
                      {t.lastMessage}
                    </p>
                  </div>
                  <span className="mono flex-shrink-0 text-[11px]" style={{ color: "var(--steel-dim)" }}>
                    {formatRelativeTime(t.lastMessageAt)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer note="เอกสารแนวคิดฉบับพรีวิว — ข้อความเชื่อมกับฐานข้อมูลจริง" />
    </div>
  );
}
