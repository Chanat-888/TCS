"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { BrandMark } from "@/components/icons/BrandMark";
import { DecoField } from "@/components/DecoField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { finishWelcome } from "./actions";

const ICONS = {
  escrow: (
    <>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  bid: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5M9 2h6" />
    </>
  ),
  video: (
    <>
      <rect x="2" y="6" width="14" height="12" rx="2" />
      <path d="M16 10l6-3v10l-6-3z" />
    </>
  ),
  sell: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  ready: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
};

const CARDS: { icon: keyof typeof ICONS; title: string; body: string; tag: string }[] = [
  {
    icon: "escrow",
    title: "เงินอยู่กับ TCS จนการ์ดถึงมือ",
    body: "ผู้ซื้อจ่ายเข้าระบบพักเงิน ผู้ขายจะได้เงินหลังผู้ซื้อกดรับการ์ดแล้วเท่านั้น",
    tag: "PAID_HELD",
  },
  {
    icon: "bid",
    title: "ประมูลแบบไม่โดนซุ่ม",
    body: "บิดใน 2 นาทีสุดท้าย เวลาจะต่อให้อีก 2 นาที ชนะแล้วจ่ายเงินภายใน 24 ชม.",
    tag: "+02:00",
  },
  {
    icon: "video",
    title: "ถ่ายวิดีโอตอนแกะกล่อง",
    body: "พอใจก็กดรับ ไม่พอใจเปิดข้อพิพาทได้ภายใน 48 ชม. โดยใช้วิดีโอเป็นหลักฐาน",
    tag: "48:00:00",
  },
  {
    icon: "sell",
    title: "ลงขายด้วยรูปหน้า–หลัง",
    body: "ตั้งราคาเริ่มและเวลาจบประมูล เมื่อมีคนบิดแล้วจะแก้ได้แค่คำอธิบาย",
    tag: "LOCKED",
  },
  {
    icon: "ready",
    title: "พร้อมเริ่มแล้ว",
    body: "ตั้งชื่อที่แสดงในโปรไฟล์ได้ทุกเมื่อ ผู้ซื้อและผู้ขายจะเห็นชื่อนี้",
    tag: "READY",
  },
];

const LAST = CARDS.length - 1;
const SWIPE_PX = 60;

function Circuit({ opacity = 0.55 }: { opacity?: number }) {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 220 308" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g stroke="var(--cyan)" strokeWidth={1} opacity={opacity} fill="none">
        <circle cx="110" cy="154" r="46" />
        <circle cx="110" cy="154" r="70" />
        <path d="M110 84 L110 54 M110 224 L110 254 M40 154 L15 154 M180 154 L205 154" />
        <path d="M60 104 L35 79 M160 104 L185 79 M60 204 L35 229 M160 204 L185 229" />
      </g>
    </svg>
  );
}

function CardBack() {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-2xl"
      style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", background: "#0D1016", border: "1.5px solid var(--cyan-line)" }}
    >
      <Circuit />
      <svg className="relative" width="56" height="56" viewBox="0 0 64 64" aria-hidden="true">
        <path d="M32 6 L40.8 25.2 L32 44.4 L23.2 25.2 Z" fill="var(--cyan)" />
      </svg>
      <span className="relative mt-3 text-[15px] font-bold tracking-[0.04em]" style={{ fontFamily: "var(--font-display)" }}>
        TCS
      </span>
    </div>
  );
}

function CardFace({ card, number }: { card: (typeof CARDS)[number]; number: number }) {
  const gold = card.icon === "ready";
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden rounded-2xl p-[clamp(10px,3.4vw,14px)]"
      style={{
        backfaceVisibility: "hidden",
        background: "var(--panel-2)",
        border: `1.5px solid ${gold ? "var(--gold-line)" : "var(--cyan-line)"}`,
        boxShadow: "0 30px 60px -24px rgba(47,143,232,0.45)",
      }}
    >
      <div className="relative flex basis-[50%] shrink-0 items-center justify-center overflow-hidden rounded-[10px]" style={{ background: "#0D1016" }}>
        <Circuit opacity={0.28} />
        <svg
          className="relative"
          width="52"
          height="52"
          viewBox="0 0 24 24"
          fill={gold ? "var(--gold)" : "none"}
          stroke={gold ? "none" : "var(--cyan)"}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {ICONS[card.icon]}
        </svg>
      </div>
      <div className="flex flex-1 flex-col px-1 pt-[clamp(10px,3.4vw,16px)]">
        <h2 className="text-[clamp(17px,5vw,20px)] leading-[1.3] [text-wrap:balance]">{card.title}</h2>
        <p className="mt-2 text-[clamp(13px,3.7vw,14.5px)] leading-[1.6]" style={{ color: "var(--steel)" }}>
          {card.body}
        </p>
      </div>
      <div className="mono flex items-center justify-between px-1 pt-2 text-[10.5px]" style={{ borderTop: "1px solid var(--line-soft)" }}>
        <span style={{ color: gold ? "var(--gold)" : "var(--cyan)" }}>{card.tag}</span>
        <span style={{ color: "var(--steel-dim)" }}>
          {String(number).padStart(2, "0")}/{String(CARDS.length).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}

function FinishButton({ children, autoFocus }: { children: React.ReactNode; autoFocus?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <PrimaryButton type="submit" loading={pending} autoFocus={autoFocus}>
      {children}
    </PrimaryButton>
  );
}

function QuietSubmit({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`min-h-11 cursor-pointer rounded-[11px] border-0 bg-transparent px-3 text-[14px] transition-colors hover:text-[var(--white)] disabled:opacity-50 ${className}`}
      style={{ color: "var(--steel)" }}
    >
      {children}
    </button>
  );
}

export function WelcomeDeck() {
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);
  const startX = useRef(0);
  const go = (next: number) => setIndex(Math.max(0, Math.min(LAST, next)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIndex((i) => Math.min(LAST, i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function endDrag() {
    if (drag !== null && drag < -SWIPE_PX) go(index + 1);
    if (drag !== null && drag > SWIPE_PX) go(index - 1);
    setDrag(null);
  }

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden">
      <DecoField count={5} cardWidth={64} cardHeight={90} edgesOnly opacityRange={[0.28, 0.28]} />

      <header className="relative z-[1] mx-auto flex w-full max-w-[520px] items-center justify-between px-4 pt-3">
        <div className="flex items-center gap-[9px]">
          <BrandMark size={28} />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17 }}>TCS</span>
        </div>
        <form action={finishWelcome.bind(null, "/browse")}>
          <QuietSubmit className="-mr-3">ข้าม</QuietSubmit>
        </form>
      </header>

      <main className="relative z-[1] mx-auto flex w-full max-w-[520px] flex-1 flex-col items-center px-4 pb-6">
        <h1 className="sr-only">ยินดีต้อนรับสู่ TCS</h1>
        <p className="sr-only" aria-live="polite">
          การ์ด {index + 1} จาก {CARDS.length}: {CARDS[index].title}
        </p>

        <div className="flex w-full flex-1 items-center justify-center py-6">
          <div
            className="relative aspect-[220/308] w-[min(72vw,300px)] touch-pan-y select-none"
            style={{ perspective: 1400 }}
            aria-roledescription="carousel"
            aria-label="วิธีใช้งาน TCS"
            onPointerDown={(e) => {
              startX.current = e.clientX;
              setDrag(0);
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => drag !== null && setDrag(e.clientX - startX.current)}
            onPointerUp={endDrag}
            onPointerCancel={() => setDrag(null)}
          >
            {CARDS.map((card, i) => {
              const d = i - index;
              const dragging = d === 0 && drag !== null;
              const place =
                d < 0
                  ? "translateX(-120%) rotate(-12deg)"
                  : d === 0
                    ? dragging
                      ? `translateX(${drag}px) rotate(${drag / 18}deg)`
                      : "none"
                    : `translate(${d * 10}px, ${d * 16}px) rotate(${d * 3.5}deg) scale(${1 - d * 0.05})`;
              return (
                <div
                  key={card.title}
                  className={`absolute inset-0 motion-reduce:transition-none ${dragging ? "" : "transition-[transform,opacity] duration-500"}`}
                  style={{
                    transform: place,
                    opacity: d < 0 || d > 2 ? 0 : 1,
                    zIndex: d < 0 ? 20 : 10 - d,
                    transitionTimingFunction: "var(--ease)",
                  }}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${i + 1} จาก ${CARDS.length}`}
                  aria-hidden={d !== 0}
                  inert={d !== 0}
                >
                  <div
                    className="relative h-full w-full transition-transform duration-700 motion-reduce:transition-none"
                    style={{
                      transformStyle: "preserve-3d",
                      transform: d > 0 ? "rotateY(180deg)" : "none",
                      transitionTimingFunction: "var(--ease)",
                      transitionDelay: d === 0 ? "120ms" : "0ms",
                    }}
                  >
                    <CardFace card={card} number={i + 1} />
                    <CardBack />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-1" aria-label="เลือกการ์ด">
          {CARDS.map((card, i) => (
            <button
              key={card.title}
              type="button"
              onClick={() => go(i)}
              className="flex h-11 w-7 cursor-pointer items-center justify-center border-0 bg-transparent p-0"
              aria-label={`การ์ด ${i + 1}: ${card.title}`}
              aria-current={i === index ? "step" : undefined}
            >
              <span
                className="block h-[7px] rounded-full transition-all duration-300"
                style={{ width: i === index ? 20 : 7, background: i === index ? "var(--cyan)" : "var(--steel-dim)" }}
              />
            </button>
          ))}
        </div>

        <div className="mt-3 w-full max-w-[400px]">
          {index < LAST ? (
            <div className="flex items-center gap-2">
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => go(index - 1)}
                  className="h-[50px] shrink-0 cursor-pointer rounded-[11px] bg-transparent px-5 text-[15px] transition-colors hover:text-[var(--white)]"
                  style={{ color: "var(--steel)", border: "1px solid var(--line)" }}
                >
                  ก่อนหน้า
                </button>
              )}
              <PrimaryButton type="button" onClick={() => go(index + 1)}>
                ถัดไป
              </PrimaryButton>
            </div>
          ) : (
            <>
              <form action={finishWelcome.bind(null, "/browse")}>
                <FinishButton autoFocus>ดูการ์ด</FinishButton>
              </form>
              <div className="mt-2 flex justify-center gap-2">
                <form action={finishWelcome.bind(null, "/listings/new")}>
                  <QuietSubmit>ลงขายการ์ด</QuietSubmit>
                </form>
                <form action={finishWelcome.bind(null, "/profile")}>
                  <QuietSubmit>ตั้งชื่อโปรไฟล์</QuietSubmit>
                </form>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
