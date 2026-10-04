import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { requireVerifiedUserId } from "@/lib/session";
import { getWantedPostById } from "@/lib/wantedPosts";
import { BackHeader } from "@/components/BackHeader";
import { Footer } from "@/components/Footer";
import { updateWantedPost } from "../../actions";
import { WantedPostForm } from "../../WantedPostForm";

export default async function EditWantedPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const userId = await requireVerifiedUserId();

  const post = await getWantedPostById(id);
  if (!post || post.poster_id !== userId) notFound();

  return (
    <div style={{ "--wrap-max": "680px" } as CSSProperties}>
      <BackHeader href="/profile" title="แก้ไขประกาศหา" />
      <main className="py-7 pb-[70px]">
        <div className="wrap">
          {post.status !== "active" ? (
            <p className="rounded-2xl p-[18px] text-[14px] leading-relaxed" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)", color: "var(--steel)" }}>
              ประกาศนี้ปิดแล้ว แก้ไขไม่ได้ ถ้ายังต้องการหาการ์ด กรุณาลงประกาศใหม่
            </p>
          ) : (
            <WantedPostForm action={updateWantedPost.bind(null, id)} submitLabel="บันทึกการแก้ไข" post={post} error={Boolean(error)} />
          )}
        </div>
      </main>
      <Footer note="เอกสารแนวคิดฉบับพรีวิว — ประกาศหาเชื่อมกับฐานข้อมูลจริง" />
    </div>
  );
}
