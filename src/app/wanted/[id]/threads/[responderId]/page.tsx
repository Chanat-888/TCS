import type { CSSProperties } from "react";
import { notFound, redirect } from "next/navigation";
import { requireVerifiedUserId } from "@/lib/session";
import { getWantedPostById, getWantedPostThread } from "@/lib/wantedPosts";
import { getProfile } from "@/lib/queries";
import { BackHeader } from "@/components/BackHeader";
import { Footer } from "@/components/Footer";
import { WantedChatView } from "@/components/WantedChatView";

export default async function WantedPostThreadPage({ params }: { params: Promise<{ id: string; responderId: string }> }) {
  const { id, responderId } = await params;
  const userId = await requireVerifiedUserId();

  const post = await getWantedPostById(id);
  if (!post) notFound();
  if (post.poster_id !== userId) redirect(`/wanted/${id}/chat`);

  const [responder, messages] = await Promise.all([getProfile(responderId), getWantedPostThread(id, responderId)]);
  if (!responder) notFound();

  return (
    <div style={{ "--wrap-max": "680px" } as CSSProperties}>
      <BackHeader href={`/wanted/${id}/threads`} title={responder.display_name} subtitle={post.name} />
      <main className="py-7 pb-[70px]">
        <div className="wrap">
          <WantedChatView
            wantedPostId={post.id}
            responderId={responder.id}
            currentUserId={userId}
            messages={messages}
            otherPartyLabel={responder.display_name.slice(0, 2).toUpperCase()}
          />
        </div>
      </main>
      <Footer note="เอกสารแนวคิดฉบับพรีวิว — ข้อความเชื่อมกับฐานข้อมูลจริง" />
    </div>
  );
}
