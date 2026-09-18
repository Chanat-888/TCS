"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { BrandMark } from "@/components/icons/BrandMark";
import { DecoField } from "@/components/DecoField";

const PROBLEMS = [
  { title: "ไม่มีระบบพักเงิน", body: "ผู้ซื้อโอนเงินก่อน แล้วหวังว่าผู้ขายจะส่งของจริง" },
  { title: "ไม่มีตัวตนจริง", body: "โดนโกงแล้วสร้างบัญชีใหม่ได้ทันที ประวัติเดิมหายไปเฉยๆ" },
  { title: "ไม่มีหลักฐานตอนแกะกล่อง", body: "เถียงกันไปมาว่าใครพูดจริง ไม่มีอะไรพิสูจน์ได้" },
];

const FLOW_STEPS = [
  { n: 1, title: "ประมูลจบ ผู้ชนะจ่ายเงิน", status: null, desc: "ผู้ชนะโอนเงินเข้าระบบพักเงินของ TCS ผ่านผู้ให้บริการชำระเงินที่มีใบอนุญาต — TCS เองไม่แตะเงินโดยตรง" },
  { n: 2, title: "เงินถูกพักไว้", status: "PAID_HELD", desc: "ผู้ขายเห็นสถานะ \"เงินถูกพักไว้\" แล้วค่อยแพ็คและส่งของ พร้อมใส่เลขพัสดุให้ทั้งสองฝ่ายติดตามได้" },
  { n: 3, title: "ของถึงมือ ถ่ายวิดีโอแกะกล่อง", status: null, desc: "ผู้ซื้อถ่ายวิดีโอตอนแกะกล่องในแอป — เป็นหลักฐานเดียวที่ใช้เปิดข้อพิพาทได้ ไม่มีวิดีโอ ไม่มีสิทธิ์เปิดข้อพิพาท" },
  { n: 4, title: "กดรับ หรือเปิดข้อพิพาท", status: "COMPLETED / DISPUTED", desc: "พอใจ กดรับ เงินโอนให้ผู้ขายทันที ไม่พอใจ เปิดข้อพิพาทภายใน 48 ชม. แอดมินเทียบรูปสินค้ากับวิดีโอแกะกล่องแล้วตัดสิน ถ้าไม่ทำอะไรเลย ระบบอนุมัติให้อัตโนมัติหลัง 48 ชม." },
];

function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`reveal ${className}`} data-reveal>
      {children}
    </div>
  );
}

function CardObject({
  innerRef,
  size = "large",
  backStatus,
  frontStatus,
  frontWord = "อนุมัติแล้ว",
}: {
  innerRef: React.RefObject<HTMLDivElement | null>;
  size?: "large" | "small";
  backStatus: string;
  frontStatus: string;
  frontWord?: string;
}) {
  const dims = size === "large" ? { w: 220, h: 308 } : { w: 176, h: 246 };
  return (
    <div className="relative" style={{ width: dims.w, height: dims.h, perspective: 1400 }}>
      <div ref={innerRef} className="relative h-full w-full" style={{ transformStyle: "preserve-3d" }}>
        <div
          className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-2xl"
          style={{ backfaceVisibility: "hidden", background: "#0D1016", border: "1.5px solid rgba(95,212,255,0.35)", boxShadow: "0 0 0 1px rgba(0,0,0,0.4), 0 30px 60px -20px rgba(47,143,232,0.35)" }}
        >
          <svg className="absolute inset-0 h-full w-full opacity-90" viewBox="0 0 220 308" aria-hidden="true">
            <g stroke="var(--cyan)" strokeWidth={1} opacity={0.55} fill="none">
              <circle cx="110" cy="140" r="46" />
              <circle cx="110" cy="140" r="70" />
              <path d="M110 70 L110 40 M110 210 L110 240 M40 140 L15 140 M180 140 L205 140" />
              <path d="M60 90 L35 65 M160 90 L185 65 M60 190 L35 215 M160 190 L185 215" />
            </g>
            <g stroke="var(--cyan)" strokeWidth={0.75} opacity={0.3} fill="none">
              <rect x="18" y="18" width="184" height="272" rx="12" />
            </g>
          </svg>
          <svg className="relative z-[1]" width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
            <path d="M32 6 L40.8 25.2 L32 44.4 L23.2 25.2 Z" fill="var(--cyan)" />
          </svg>
          <span className="relative z-[1] mt-[14px] text-[15px] font-bold tracking-[0.04em]" style={{ fontFamily: "var(--font-display)", color: "var(--white)" }}>
            TCS
          </span>
          <span className="mono absolute inset-x-0 bottom-[18px] z-[1] text-center text-[10.5px]" style={{ color: "var(--steel)" }}>
            {backStatus}
          </span>
        </div>

        <div
          className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-2xl"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", background: "var(--panel-2)", border: "1.5px solid rgba(95,212,255,0.5)", boxShadow: "0 0 0 1px rgba(0,0,0,0.4), 0 30px 60px -20px rgba(95,212,255,0.4)" }}
        >
          <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="26" fill="none" stroke="var(--blue)" strokeWidth={3} />
            <path d="M21 33 L28 40 L44 23" stroke="var(--blue)" strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="mt-[14px] text-[15px] font-bold tracking-[0.04em]" style={{ fontFamily: "var(--font-display)", color: "var(--blue-dim)" }}>
            {frontWord}
          </span>
          <span className="mono absolute inset-x-0 bottom-[18px] text-center text-[10.5px]" style={{ color: "var(--blue-dim)" }}>
            {frontStatus}
          </span>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  const heroInner = useRef<HTMLDivElement>(null);
  const mechInner = useRef<HTMLDivElement>(null);
  const whatSectionRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const flowFillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      if (!reduced) {
        gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
          gsap.fromTo(
            el,
            { opacity: 0, y: 24 },
            { opacity: 1, y: 0, duration: 0.6, ease: "power2.out", scrollTrigger: { trigger: el, start: "top 88%", toggleActions: "play none none reverse" } }
          );
        });

        if (heroInner.current) {
          gsap.to(heroInner.current, { rotateY: 14, rotateX: -4, duration: 3.2, ease: "sine.inOut", yoyo: true, repeat: -1 });
        }

        if (mechInner.current && whatSectionRef.current) {
          gsap.timeline({ scrollTrigger: { trigger: whatSectionRef.current, start: "top 60%", end: "bottom 40%", scrub: 0.8 } }).to(mechInner.current, {
            rotateY: 180,
            ease: "none",
          });
        }

        if (flowFillRef.current && flowRef.current) {
          gsap.to(flowFillRef.current, { height: "100%", ease: "none", scrollTrigger: { trigger: flowRef.current, start: "top 70%", end: "bottom 80%", scrub: 0.6 } });
        }
      } else {
        gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => (el.style.opacity = "1"));
        if (mechInner.current) mechInner.current.style.transform = "rotateY(180deg)";
        if (flowFillRef.current) flowFillRef.current.style.height = "100%";
      }
    });
    return () => ctx.revert();
  }, []);

  return (
    <>
      <header
        className="fixed inset-x-0 top-0 z-40 flex items-center justify-between px-7 py-[18px] max-[640px]:px-5"
        style={{ background: "rgba(10,12,16,0.72)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderBottom: "1px solid rgba(140,147,163,0.1)" }}
      >
        <a href="#top" className="flex items-center gap-[10px] no-underline" aria-label="TCS — กลับไปด้านบนสุด">
          <BrandMark size={34} />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 19, letterSpacing: "-0.01em", color: "var(--white)" }}>TCS</span>
        </a>
        <span className="mono rounded-full px-3 py-[5px] text-[12px]" style={{ color: "var(--steel)", border: "1px solid rgba(140,147,163,0.3)", letterSpacing: "0.02em" }}>
          แนวคิด — ยังไม่เปิดบริการ
        </span>
      </header>

      <main id="top">
        <section className="relative flex min-h-svh items-center overflow-hidden px-0 pb-20 pt-[140px] max-[900px]:pt-[120px]">
          <DecoField count={5} cardWidth={74} cardHeight={104} opacityRange={[0.18, 0.4]} />
          <div className="wrap relative z-[1] grid gap-12 max-[900px]:gap-16" style={{ gridTemplateColumns: "1.1fr 0.9fr", alignItems: "center" }}>
            <Reveal>
              <h1 className="max-w-[12ch] text-[clamp(2.4rem,5.4vw,4.1rem)] leading-[1.06]">
                เงินไม่ขยับ
                <br />
                จนกว่าคุณจะพยักหน้า
              </h1>
              <p className="mt-6 max-w-[46ch] text-[17px] leading-loose" style={{ color: "var(--steel)" }}>
                TCS คือตลาดซื้อขายการ์ดสำหรับนักสะสม ที่เงินของผู้ซื้อจะอยู่กับ TCS จนกว่าการ์ดจะถึงมือจริง — ไม่ใช่อยู่กับผู้ขาย ไม่ใช่อยู่กับคอมเมนต์ในเฟซบุ๊ก
              </p>
              <div className="mono mt-9 flex items-center gap-[14px] text-[12.5px]" style={{ color: "var(--cyan)" }}>
                <span className="rounded-full" style={{ width: 6, height: 6, background: "var(--cyan)", boxShadow: "0 0 8px 1px var(--cyan)" }} />
                <span>เริ่มต้นที่ Cardfight!! Vanguard</span>
              </div>
            </Reveal>
            <Reveal className="flex items-center justify-center" >
              <div className="flex h-[420px] items-center justify-center max-[900px]:h-[320px]">
                <CardObject innerRef={heroInner} backStatus="เงินถูกพักไว้" frontStatus="โอนให้ผู้ขายแล้ว" frontWord="อนุมัติแล้ว" />
              </div>
            </Reveal>
          </div>
        </section>

        <section className="relative py-[140px] max-[640px]:py-24" ref={whatSectionRef} id="what">
          <DecoField count={4} cardWidth={74} cardHeight={104} opacityRange={[0.18, 0.4]} />
          <div className="wrap relative z-[1]">
            <Reveal className="max-w-[34ch]">
              <h2 className="text-[clamp(1.8rem,3.4vw,2.6rem)] leading-[1.15]">TCS คืออะไร</h2>
              <p className="mt-5 text-[16px] leading-loose" style={{ color: "var(--steel)" }}>
                ตลาดการ์ดทุกวันนี้คือกลุ่มเฟซบุ๊ก การประมูลไปตามคอมเมนต์ และการโอนเงินไปก่อนแล้วหวังว่าจะได้ของจริง
              </p>
            </Reveal>

            <div className="mt-[72px] grid gap-16 max-[900px]:grid-cols-1 max-[900px]:gap-14" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "center" }}>
              <Reveal>
                {PROBLEMS.map((p, i) => (
                  <div key={p.title} className="flex gap-[14px] py-[18px]" style={{ borderTop: "1px solid rgba(140,147,163,0.14)", borderBottom: i === PROBLEMS.length - 1 ? "1px solid rgba(140,147,163,0.14)" : undefined }}>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="mt-[2px] flex-shrink-0" style={{ color: "var(--danger)" }}>
                      <path d="M9 5v5M9 12.2v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.2" />
                    </svg>
                    <p className="text-[15px] leading-relaxed" style={{ color: "var(--steel)" }}>
                      <strong style={{ color: "var(--white)", fontWeight: 500 }}>{p.title}</strong> — {p.body}
                    </p>
                  </div>
                ))}
              </Reveal>

              <Reveal className="flex flex-col items-center gap-[22px]">
                <CardObject innerRef={mechInner} backStatus="PAID_HELD" frontStatus="โอนให้ผู้ขายแล้ว" frontWord="COMPLETED" />
                <p className="mono max-w-[30ch] text-center text-[12.5px]" style={{ color: "var(--steel)" }}>
                  เลื่อนหน้าจอลง แล้วดูการ์ดพลิกจาก <span style={{ color: "var(--cyan)" }}>เงินถูกพักไว้</span> เป็น <span style={{ color: "var(--cyan)" }}>โอนแล้ว</span> —
                  เหมือนกับที่เกิดขึ้นจริงในทุกออเดอร์
                </p>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="py-[140px] max-[640px]:py-24" id="how">
          <div className="wrap">
            <Reveal className="max-w-[34ch]">
              <h2 className="text-[clamp(1.8rem,3.4vw,2.6rem)] leading-[1.15]">เส้นทางของเงิน ตั้งแต่ประมูลจบถึงจบดีล</h2>
              <p className="mt-5 text-[16px] leading-loose" style={{ color: "var(--steel)" }}>
                ทุกออเดอร์เดินตามเส้นทางเดียวกัน เงินขยับก็ต่อเมื่อมีหลักฐานว่าถึงเวลาขยับจริง
              </p>
            </Reveal>

            <div className="relative mt-[72px]" ref={flowRef}>
              <div className="absolute bottom-2 left-[15px] top-2 w-[2px]" style={{ background: "rgba(140,147,163,0.16)" }}>
                <div ref={flowFillRef} className="w-full" style={{ height: 0, background: "linear-gradient(to bottom, var(--cyan), var(--blue))", transformOrigin: "top" }} />
              </div>

              {FLOW_STEPS.map((step) => (
                <Reveal key={step.n} className="relative pb-14 pl-[56px] last:pb-0">
                  <div
                    className="mono absolute left-0 top-[2px] flex items-center justify-center rounded-full text-[12px]"
                    style={{
                      width: 32,
                      height: 32,
                      background: "var(--panel)",
                      border: `1.5px solid ${step.status ? "var(--cyan)" : "rgba(140,147,163,0.3)"}`,
                      color: step.status ? "var(--cyan)" : "var(--steel)",
                      boxShadow: step.status ? "0 0 0 4px rgba(95,212,255,0.08)" : undefined,
                    }}
                  >
                    {step.n}
                  </div>
                  <h3 className="text-[18px] font-semibold" style={{ color: "var(--white)" }}>
                    {step.title}
                  </h3>
                  {step.status && (
                    <span className="mono mt-2 inline-block rounded-full px-[9px] py-[3px] text-[11px]" style={{ letterSpacing: "0.06em", color: "var(--cyan)", background: "rgba(95,212,255,0.08)", border: "1px solid rgba(95,212,255,0.2)" }}>
                      {step.status}
                    </span>
                  )}
                  <p className="mt-[10px] max-w-[52ch] text-[15px] leading-loose" style={{ color: "var(--steel)" }}>
                    {step.desc}
                  </p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="px-0 pb-[120px] pt-[160px] text-center max-[640px]:pt-24">
          <div className="wrap">
            <Reveal>
              <h2 className="text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.1]">
                เทรดการ์ด <span style={{ color: "var(--cyan)" }}>เชื่อใจตอนพลิก</span>
              </h2>
            </Reveal>
            <Reveal>
              <p className="mx-auto mt-6 max-w-[40ch] text-[16px]" style={{ color: "var(--steel)" }}>
                TCS กำลังเริ่มต้นกับกลุ่มผู้ขายการ์ด Cardfight!! Vanguard กลุ่มแรก ก่อนขยายไปเกมการ์ดอื่น
              </p>
            </Reveal>
            <Reveal>
              <div
                className="mono mt-11 inline-flex items-center gap-3 rounded-full px-[26px] py-[14px] text-[13px]"
                style={{ background: "var(--panel)", border: "1px solid rgba(95,212,255,0.28)", color: "var(--white)", letterSpacing: "0.02em" }}
              >
                <span className="animate-pulse rounded-full" style={{ width: 7, height: 7, background: "var(--cyan)", boxShadow: "0 0 10px 2px var(--cyan)" }} />
                <span>เปิดตัวเร็ว ๆ นี้ — ยังไม่เปิดลงทะเบียน</span>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="py-10" style={{ borderTop: "1px solid rgba(140,147,163,0.14)" }}>
        <div className="wrap flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-[10px]">
            <BrandMark size={22} variant="compact" />
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, color: "var(--steel)" }}>TCS</span>
          </div>
          <p className="text-[13px]" style={{ color: "var(--steel-dim)" }}>
            เอกสารแนวคิดฉบับพรีวิว — ยังไม่ใช่ระบบที่เปิดให้บริการจริง
          </p>
        </div>
      </footer>
    </>
  );
}
