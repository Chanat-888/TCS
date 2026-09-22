"use client";

import { useState } from "react";

type ChatMessage = { id: string; sender_id: string; body: string; created_at: string };

export function ChatPanel({
  initialMessages,
  currentUserId,
  avatarFor,
  onSend,
  readOnly,
}: {
  initialMessages: ChatMessage[];
  currentUserId: string;
  avatarFor: (senderId: string, isMe: boolean) => string;
  onSend: (body: string) => Promise<{ error?: string; success?: boolean }>;
  readOnly?: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");

  async function send() {
    const body = input.trim();
    if (!body) return;
    setInput("");
    const optimistic: ChatMessage = {
      id: crypto.randomUUID(),
      sender_id: currentUserId,
      body,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    await onSend(body);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl p-4" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
      {messages.map((msg) => {
        const isMe = msg.sender_id === currentUserId;
        return (
          <div key={msg.id} className={`flex max-w-[82%] gap-[10px] ${isMe ? "flex-row-reverse self-end" : ""}`}>
            <div
              className="flex flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
              style={{ width: 28, height: 28, background: "var(--panel-2)", color: "var(--steel)", fontFamily: "var(--font-display)" }}
            >
              {avatarFor(msg.sender_id, isMe)}
            </div>
            <div>
              <div
                className="rounded-xl px-[13px] py-[9px] text-[13.5px] leading-relaxed"
                style={{ background: isMe ? "var(--blue-dim)" : "var(--panel-2)", color: "var(--white)" }}
              >
                {msg.body}
              </div>
              <span className="mono mt-1 block text-[10.5px]" style={{ color: "var(--steel-dim)" }}>
                {new Date(msg.created_at).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
        );
      })}

      {!readOnly && (
        <div className="mt-1 flex gap-2">
          <input
            className="h-[42px] flex-1 rounded-[10px] px-[13px] text-[13.5px] outline-none"
            style={{ background: "var(--panel-2)", border: "1px solid rgba(140,147,163,0.2)", color: "var(--white)" }}
            placeholder="พิมพ์ข้อความ..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
          />
          <button
            type="button"
            aria-label="ส่งข้อความ"
            onClick={send}
            className="flex flex-shrink-0 items-center justify-center rounded-[10px]"
            style={{ width: 42, height: 42, background: "var(--blue)", color: "#071523" }}
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M3 10h13M10 3l7 7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
