"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { formatRelativeTime } from "@/lib/format";
import { useDisclosure, panelClass, circleButtonStyle } from "@/components/HeaderMenus";

type NotificationRow = {
  id: string;
  type: "outbid" | "auction_won" | "auction_ended" | "auction_ending_soon";
  title: string;
  body: string | null;
  listing_id: string | null;
  order_id: string | null;
  read_at: string | null;
  created_at: string;
};

const SHOWN = 15;

function targetHref(n: NotificationRow): string | null {
  if (n.order_id) return `/orders/${n.order_id}`;
  if (n.listing_id) return `/listings/${n.listing_id}`;
  return null;
}

const TYPE_ICON: Record<NotificationRow["type"], string> = {
  outbid: "⚡",
  auction_won: "🏆",
  auction_ended: "🔔",
  auction_ending_soon: "⏰",
};

/** Bell with unread count; loads recent notifications and stays live via Realtime, same pattern as LiveBidding. */
export function NotificationBell({ userId }: { userId: string }) {
  const { open, setOpen, ref } = useDisclosure();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const unread = notifications.filter((n) => !n.read_at).length;

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let cancelled = false;

    supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(SHOWN)
      .then(({ data }) => {
        if (!cancelled) {
          setNotifications((data as NotificationRow[]) ?? []);
          setLoaded(true);
        }
      });

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as NotificationRow;
          setNotifications((prev) => (prev.some((n) => n.id === row.id) ? prev : [row, ...prev].slice(0, SHOWN)));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  async function markRead(ids: string[]) {
    if (ids.length === 0) return;
    setNotifications((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n)));
    const supabase = createBrowserSupabaseClient();
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids).is("read_at", null);
  }

  function handleOpen() {
    setOpen((o) => {
      const next = !o;
      if (next) markRead(notifications.filter((n) => !n.read_at).map((n) => n.id));
      return next;
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="การแจ้งเตือน"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={handleOpen}
        className="relative flex cursor-pointer items-center justify-center rounded-full"
        style={circleButtonStyle}
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M10 3.2c-2.2 0-4 1.8-4 4v2.4c0 .7-.28 1.36-.78 1.86L4 12.7v.8h12v-.8l-1.22-1.23a2.63 2.63 0 0 1-.78-1.86V7.2c0-2.2-1.8-4-4-4Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path d="M8.3 15.5a1.9 1.9 0 0 0 3.4 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        {unread > 0 && (
          <span
            className="mono absolute flex items-center justify-center rounded-full"
            style={{
              top: -3,
              right: -3,
              minWidth: 17,
              height: 17,
              padding: "0 4px",
              fontSize: 10,
              background: "var(--danger)",
              color: "var(--ink-on-danger)",
              border: "1.5px solid var(--bg)",
            }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      <div className={`${panelClass(open)} right-0`}>
        <div
          className="flex max-h-[420px] w-[320px] flex-col overflow-y-auto rounded-2xl p-2"
          style={{ background: "var(--panel)", border: "1px solid var(--line)", boxShadow: "0 24px 48px -16px rgba(0,0,0,0.5)" }}
        >
          <p className="px-2 py-2 text-[13px] font-medium" style={{ color: "var(--white)" }}>
            การแจ้งเตือน
          </p>
          {loaded && notifications.length === 0 ? (
            <p className="px-2 pb-3 text-[13px]" style={{ color: "var(--steel)" }}>
              ยังไม่มีการแจ้งเตือน
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {notifications.map((n) => {
                const href = targetHref(n);
                const body = (
                  <>
                    <span className="mt-[1px] flex-shrink-0" aria-hidden="true">
                      {TYPE_ICON[n.type]}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium" style={{ color: "var(--white)" }}>
                        {n.title}
                      </span>
                      {n.body && (
                        <span className="mt-[2px] block text-[12px] leading-snug" style={{ color: "var(--steel)" }}>
                          {n.body}
                        </span>
                      )}
                      <span className="mt-1 block text-[11px]" style={{ color: "var(--steel-dim)" }}>
                        {formatRelativeTime(n.created_at)}
                      </span>
                    </span>
                  </>
                );
                const rowClass = "flex items-start gap-2 rounded-xl p-2 no-underline transition-colors hover:bg-[var(--line-soft)]";
                const rowStyle = { background: n.read_at ? "transparent" : "var(--cyan-tint)" };
                return (
                  <li key={n.id}>
                    {href ? (
                      <Link href={href} className={rowClass} style={rowStyle} onClick={() => setOpen(false)}>
                        {body}
                      </Link>
                    ) : (
                      <div className={rowClass} style={rowStyle}>
                        {body}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
