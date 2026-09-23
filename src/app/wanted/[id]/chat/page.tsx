import type { CSSProperties } from "react";
import { notFound, redirect } from "next/navigation";
import { requireVerifiedUserId } from "@/lib/session";
import { getWantedPostById, getWantedPostThread } from "@/lib/wantedPosts";
import { getProfile } from "@/lib/queries";
import { BackHeader } from "@/components/BackHeader";
import { Footer } from "@/components/Footer";
import { WantedChatView } from "@/components/WantedChatView";

export default async function WantedPostChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireVerifiedUserId();

  const post = await getWantedPostById(id);
  if (!post) notFound();
  if (post.poster_id === userId) redirect(`/wanted/${id}/threads`);

  const [poster, messages] = await Promise.all([getProfile(post.poster_id), getWantedPostThread(id, userId)]);

  return (
    <div style={{ "--wrap-max": "680px" } as CSSProperties}>
      <BackHeader href="/browse?type=wanted" title={post.name} subtitle={`แชทกับ ${poster?.display_name ?? "ผู้ตั้งประกาศ"}`} />
      <main className="py-7 pb-[70px]">
        <div className="wrap">
          <WantedChatView
            wantedPostId={post.id}
            responderId={userId}
            currentUserId={userId}
            messages={messages}
            otherPartyLabel={(poster?.display_name ?? "ผ").slice(0, 2).toUpperCase()}
          />
        </div>
      </main>
      <Footer note="เอกสารแนวคิดฉบับพรีวิว — ข้อความเชื่อมกับฐานข้อมูลจริง" />
    </div>
  );
}
