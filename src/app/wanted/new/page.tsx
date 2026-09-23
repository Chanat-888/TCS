import type { CSSProperties } from "react";
import { requireVerifiedUserId } from "@/lib/session";
import { BackHeader } from "@/components/BackHeader";
import { Footer } from "@/components/Footer";
import { createWantedPost } from "../actions";

const inputStyle: CSSProperties = {
  width: "100%",
  background: "var(--panel-2)",
  border: "1px solid rgba(140,147,163,0.2)",
  borderRadius: 10,
  height: 44,
  padding: "0 13px",
  color: "var(--white)",
  fontSize: 14.5,
  outline: "none",
};

export default async function NewWantedPostPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireVerifiedUserId();
  const { error } = await searchParams;

  return (
    <div style={{ "--wrap-max": "680px" } as CSSProperties}>
      <BackHeader href="/profile" title="ลงประกาศหาการ์ด" />
      <main className="py-7 pb-[70px]">
        <div className="wrap">
          <h2 className="mb-3 text-[14px] font-medium" style={{ color: "var(--steel)" }}>
            คุณกำลังหาการ์ดอะไร
          </h2>
          <form action={createWantedPost} className="rounded-2xl p-[18px]" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
            <div>
              <label className="mb-[7px] block text-[12.5px]" style={{ color: "var(--steel)" }}>
                ชื่อการ์ด
              </label>
              <input name="name" required style={inputStyle} placeholder="เช่น Dragonic Overlord SP" />
            </div>
            <div className="mt-[14px] grid grid-cols-2 gap-3 max-[420px]:grid-cols-1">
              <div>
                <label className="mb-[7px] block text-[12.5px]" style={{ color: "var(--steel)" }}>
                  ชุด
                </label>
                <input name="set" required style={inputStyle} placeholder="เช่น Vanguard DZ-BT01" />
              </div>
              <div>
                <label className="mb-[7px] block text-[12.5px]" style={{ color: "var(--steel)" }}>
                  หมวดหมู่
                </label>
                <select name="category" required defaultValue="" style={inputStyle}>
                  <option value="" disabled>เลือกหมวดหมู่</option>
                  <option value="new">บูสเตอร์ใหม่</option>
                  <option value="deck">เด็คพร้อมเล่น</option>
                  <option value="rare">การ์ดหายาก</option>
                </select>
              </div>
            </div>
            <div className="mt-[14px]">
              <label className="mb-[7px] block text-[12.5px]" style={{ color: "var(--steel)" }}>
                งบสูงสุด
              </label>
              <div className="relative">
                <span className="mono pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-[14.5px]" style={{ color: "var(--steel)" }}>
                  ฿
                </span>
                <input name="maxPrice" required type="number" min={1} inputMode="numeric" className="mono" style={{ ...inputStyle, paddingLeft: 30 }} placeholder="1,000" />
              </div>
            </div>
            <div className="mt-[14px]">
              <label className="mb-[7px] block text-[12.5px]" style={{ color: "var(--steel)" }}>
                รายละเอียดเพิ่มเติม (ไม่บังคับ)
              </label>
              <textarea
                name="note"
                maxLength={400}
                placeholder="เช่น สภาพดีมาก ไม่มีตำหนิ พร้อมโอนไว"
                className="w-full resize-y rounded-[10px] p-[11px] text-[14.5px] leading-relaxed outline-none"
                style={{ background: "var(--panel-2)", border: "1px solid rgba(140,147,163,0.2)", color: "var(--white)", minHeight: 76 }}
              />
            </div>

            {error && (
              <p className="mt-3 text-[12.5px]" style={{ color: "var(--danger)" }}>
                กรอกข้อมูลให้ครบก่อนเผยแพร่ประกาศ
              </p>
            )}
            <button type="submit" className="mt-[22px] h-[52px] w-full rounded-xl text-[15.5px] font-semibold" style={{ background: "var(--blue)", color: "#071523" }}>
              เผยแพร่ประกาศหา
            </button>
          </form>
        </div>
      </main>
      <Footer note="เอกสารแนวคิดฉบับพรีวิว — ประกาศหาเชื่อมกับฐานข้อมูลจริง" />
    </div>
  );
}
