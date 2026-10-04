"use client";

import { ChatPanel } from "@/components/ChatPanel";
import type { WantedPostMessage } from "@/lib/supabase/types";
import { getWantedThreadMessages, sendWantedPostMessage } from "@/app/wanted/actions";

export function WantedChatView({
  wantedPostId,
  responderId,
  currentUserId,
  messages,
  otherPartyLabel,
  readOnly,
}: {
  wantedPostId: string;
  responderId: string;
  currentUserId: string;
  messages: WantedPostMessage[];
  /** Short initials/label for the other person in the thread. */
  otherPartyLabel: string;
  /** A closed post can still be read, but no new messages can be added. */
  readOnly?: boolean;
}) {
  return (
    <ChatPanel
      initialMessages={messages}
      currentUserId={currentUserId}
      readOnly={readOnly}
      avatarFor={(senderId, isMe) => (isMe ? "คุณ" : otherPartyLabel)}
      onSend={(body) => sendWantedPostMessage(wantedPostId, responderId, body)}
      onFetch={() => getWantedThreadMessages(wantedPostId, responderId)}
    />
  );
}
