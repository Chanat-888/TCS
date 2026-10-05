import type { CSSProperties } from "react";
import { BackHeader } from "@/components/BackHeader";
import { Footer } from "@/components/Footer";
import { TERMS_VERSION } from "@/lib/termsConfig";

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

/** Shared by /terms and /privacy. The text is a draft (docs/terms-draft.md) until a lawyer approves it. */
export function LegalPage({ title, sections }: { title: string; sections: LegalSection[] }) {
  return (
    <div style={{ "--wrap-max": "720px" } as CSSProperties}>
      <BackHeader href="/browse" title={title} />
      <main className="py-7 pb-[70px]">
        <div className="wrap">
          <p className="rounded-xl px-4 py-3 text-[13px]" style={{ background: "var(--panel)", border: "1px solid var(--gold-line)", color: "var(--gold)" }}>
            ฉบับร่าง ({TERMS_VERSION}) ยังไม่ผ่านการตรวจโดยทนายความ ข้อความที่ระบุว่า &quot;รอทนายยืนยัน&quot; ยังไม่เป็นที่สิ้นสุด
          </p>
          {sections.map((s) => (
            <section key={s.heading} className="mt-7">
              <h2 className="text-[1.05rem]">{s.heading}</h2>
              {s.paragraphs.map((p) => (
                <p key={p} className="mt-2 text-[14px] leading-[1.75]" style={{ color: "var(--steel)" }}>{p}</p>
              ))}
            </section>
          ))}
        </div>
      </main>
      <Footer note={`TCS · ${TERMS_VERSION}`} />
    </div>
  );
}
