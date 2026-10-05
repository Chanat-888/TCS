"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ChatMessage = { id: string; sender_id: string; body: string; created_at: string };
type Fetched = { error?: string; messages?: ChatMessage[] };

const MAX_LENGTH = 1000;
const POLL_MS = 5000;
// crypto.randomUUID is missing on plain-http pages (e.g. a phone opening the dev server by its IP).
let tempCounter = 0;
const tempId = () => `tmp-${Date.now().toString(36)}-${tempCounter++}`;

function formatTime(iso: string) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return d.toLocaleString("th-TH", sameDay ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function ChatPanel({
  initialMessages,
  currentUserId,
  avatarFor,
  onSend,
  onFetch,
  readOnly,
}: {
  initialMessages: ChatMessage[];
  currentUserId: string;
  avatarFor: (senderId: string, isMe: boolean) => string;
  onSend: (body: string) => Promise<{ error?: string; success?: boolean }>;
  /** Loads the whole conversation again; used to show the other person's new messages without a reload. */
  onFetch?: () => Promise<Fetched>;
  readOnly?: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const pending = useRef(0); // sends in flight: a refresh must not wipe their temporary rows

  const refresh = useCallback(async () => {
    if (!onFetch || pending.current > 0) return;
    const result = await onFetch().catch(() => null);
    if (!result?.messages || pending.current > 0) return;
    const fresh = result.messages;
    setMessages((prev) => (prev.length === fresh.length && prev.every((m, i) => m.id === fresh[i].id) ? prev : fresh));
  }, [onFetch]);

  // Check for the other person's messages while the tab is open and visible.
  useEffect(() => {
    if (!onFetch) return;
    const tick = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [onFetch, refresh]);

  // Keep the newest message in view.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  async function send() {
    const body = input.trim();
    if (!body || sending) return;
    setInput("");
    setError("");
    setSending(true);
    pending.current++;
    const temp: ChatMessage = { id: tempId(), sender_id: currentUserId, body, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, temp]);
    const result = await onSend(body).catch(() => ({ error: "ส่งข้อความไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง", success: false }));
    pending.current--;
    setSending(false);
    if (result.error || !result.success) {
      // Don't leave a message that never arrived looking sent: take it back and return the text.
      setMessages((prev) => prev.filter((m) => m.id !== temp.id));
      setInput(body);
      setError(result.error ?? "ส่งข้อความไม่สำเร็จ ลองอีกครั้ง");
      return;
    }
    await refresh(); // swaps the temporary row for the saved one
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
            <div className="min-w-0">
              <div
                className="whitespace-pre-wrap break-words rounded-xl px-[13px] py-[9px] text-[13.5px] leading-relaxed"
                style={{ background: isMe ? "var(--blue-dim)" : "var(--panel-2)", color: "var(--white)", opacity: msg.id.startsWith("tmp-") ? 0.6 : 1 }}
              >
                {msg.body}
              </div>
              <span className="mono mt-1 block text-[10.5px]" style={{ color: "var(--steel-dim)" }}>
                {formatTime(msg.created_at)}
              </span>
            </div>
          </div>
        );
      })}
      <div ref={endRef} />

      {!readOnly && (
        <>
          {error && (
            <p role="alert" className="text-[12.5px]" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}
          <div className="mt-1 flex gap-2">
            <input
              className="h-[42px] min-w-0 flex-1 rounded-[10px] px-[13px] text-[13.5px] outline-none"
              style={{ background: "var(--panel-2)", border: "1px solid rgba(140,147,163,0.2)", color: "var(--white)" }}
              placeholder="พิมพ์ข้อความ..."
              maxLength={MAX_LENGTH}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) send();
              }}
            />
            <button
              type="button"
              aria-label="ส่งข้อความ"
              onClick={send}
              disabled={sending}
              className="flex flex-shrink-0 items-center justify-center rounded-[10px] disabled:opacity-60"
              style={{ width: 42, height: 42, background: "var(--blue)", color: "#071523" }}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M3 10h13M10 3l7 7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
