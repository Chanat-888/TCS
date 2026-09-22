"use client";

import { ChatPanel } from "@/components/ChatPanel";
import type { WantedPostMessage } from "@/lib/supabase/types";
import { sendWantedPostMessage } from "@/app/wanted/actions";

export function WantedChatView({
  wantedPostId,
  responderId,
  currentUserId,
  messages,
  otherPartyLabel,
}: {
  wantedPostId: string;
  responderId: string;
  currentUserId: string;
  messages: WantedPostMessage[];
  /** Short initials/label for the other person in the thread. */
  otherPartyLabel: string;
}) {
  return (
    <ChatPanel
      initialMessages={messages}
      currentUserId={currentUserId}
      avatarFor={(senderId, isMe) => (isMe ? "คุณ" : otherPartyLabel)}
      onSend={(body) => sendWantedPostMessage(wantedPostId, responderId, body)}
    />
  );
}
