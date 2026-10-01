"use client";

import { BrandMark } from "@/components/icons/BrandMark";
import { DecoField } from "@/components/DecoField";
import { OAuthButton } from "@/components/OAuthButton";

export function LoginForm() {
  return (
    <>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <DecoField count={5} cardWidth={64} cardHeight={90} edgesOnly opacityRange={[0.28, 0.28]} />
      </div>

      <div className="relative z-[1] flex-1 flex flex-col items-center justify-center px-5 py-10">
        <div className="flex items-center gap-[10px] mb-8">
          <BrandMark size={34} />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20 }}>TCS</span>
        </div>

        <div
          className="w-full rounded-[18px] max-[460px]:rounded-2xl"
          style={{
            maxWidth: 400,
            background: "var(--panel)",
            border: "1px solid rgba(140, 147, 163, 0.14)",
            padding: "32px 28px",
          }}
        >
          <h1 className="text-[1.4rem]">เข้าสู่ระบบ TCS</h1>
          <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--steel)" }}>
            เข้าใช้ด้วย LINE โดยไม่ต้องตั้งรหัสผ่าน
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <OAuthButton provider="line" />
          </div>
          <div className="mt-4 text-center">
            <OAuthButton provider="google" quiet />
          </div>
        </div>
      </div>
    </>
  );
}
