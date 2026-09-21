"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/icons/BrandMark";
import { DecoField } from "@/components/DecoField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { OtpInput } from "@/components/ui/OtpInput";
import { sendPhoneOtp, verifyPhoneOtp } from "./actions";
import { normalizeThaiPhone } from "@/lib/phone";
import { OAuthButton } from "@/components/OAuthButton";
import { sendVerificationOtp, verifyAccountPhone } from "@/app/verify-phone/actions";

type Step = "phone" | "otp" | "success";

// Phone sign-in needs a paid SMS provider. It stays built but hidden until one is set up
// (set NEXT_PUBLIC_PHONE_LOGIN=true). Adding a phone to an existing account is unaffected.
const PHONE_LOGIN = process.env.NEXT_PUBLIC_PHONE_LOGIN === "true";

export function LoginForm({ verifyPhone = false }: { verifyPhone?: boolean }) {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState(false);
  const [error, setError] = useState("");
  const [sentPhone, setSentPhone] = useState("");
  const busy = useRef(false);
  const [sending, setSending] = useState(false);

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    if (step !== "otp" || resendSeconds <= 0) return;
    const t = setInterval(() => setResendSeconds((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [step, resendSeconds]);

  async function handleSendOtp() {
    if (busy.current || resendSeconds > 0) return;
    const normalized = normalizeThaiPhone(phone);
    if (!normalized) {
      setPhoneError(true);
      return;
    }
    busy.current = true;
    setSending(true);
    setError("");
    try {
      const result = await (verifyPhone ? sendVerificationOtp(normalized) : sendPhoneOtp(normalized));
      if (result.error) {
        setError(result.error);
        return;
      }
      setSentPhone(normalized);
      setOtp(["", "", "", "", "", ""]);
      setOtpError(false);
      setStep("otp");
      setResendSeconds(60);
    } catch {
      setError("เชื่อมต่อไม่ได้ กรุณาลองอีกครั้ง");
    } finally {
      busy.current = false;
      setSending(false);
    }
  }

  async function handleVerifyOtp() {
    if (busy.current) return;
    const code = otp.join("");
    if (!/^\d{6}$/.test(code)) {
      setOtpError(true);
      return;
    }
    busy.current = true;
    setVerifying(true);
    setError("");
    try {
      const result = await (verifyPhone ? verifyAccountPhone(sentPhone, code) : verifyPhoneOtp(sentPhone, code));
      if (result.error) {
        setError(result.error);
        return;
      }
      setStep("success");
    } catch {
      setError("เชื่อมต่อไม่ได้ กรุณาลองอีกครั้ง");
    } finally {
      busy.current = false;
      setVerifying(false);
    }
  }

  const resendLabel = `${String(Math.floor(resendSeconds / 60)).padStart(2, "0")}:${String(resendSeconds % 60).padStart(2, "0")}`;

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
          {error && <p role="alert" className="mb-4 text-[13px]" style={{ color: "var(--danger)" }}>{error}</p>}
          {step === "phone" && (
            <div className="flex flex-col">
              <h1 className="text-[1.4rem]">{verifyPhone ? "ยืนยันเบอร์โทรศัพท์" : "เข้าสู่ระบบ TCS"}</h1>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--steel)" }}>
                {verifyPhone ? "ยืนยันเบอร์โทรกับบัญชีนี้ ก่อนประมูล ซื้อ หรือลงขาย — ประวัติและประกาศของคุณยังอยู่ในบัญชีเดิม" : PHONE_LOGIN ? "เข้าใช้ด้วย LINE, Google หรือรับรหัส OTP ทาง SMS โดยไม่ต้องตั้งรหัสผ่าน" : "เข้าใช้ด้วย LINE หรือ Google โดยไม่ต้องตั้งรหัสผ่าน"}
              </p>

              {!verifyPhone && (
                <div className="mt-6">
                  <div className="flex flex-col gap-3">
                    <OAuthButton provider="line" disabled={sending} />
                    <OAuthButton provider="google" disabled={sending} />
                  </div>
                  <p hidden={!PHONE_LOGIN} className="text-center mt-5 text-[12px]" style={{ color: "var(--steel)" }}>หรือใช้เบอร์โทรศัพท์</p>
                </div>
              )}
              {(verifyPhone || PHONE_LOGIN) && (<>
              <div className="mt-6">
                <label className="block text-[12.5px] mb-2" style={{ color: "var(--steel)" }} htmlFor="phone">
                  เบอร์โทรศัพท์
                </label>
                <div
                  className="flex items-center gap-[10px] rounded-[11px] px-[14px] transition-colors"
                  style={{
                    background: "var(--panel-2)",
                    border: "1px solid rgba(140, 147, 163, 0.2)",
                    height: 50,
                  }}
                >
                  <span className="mono text-[15px] flex-shrink-0" style={{ color: "var(--steel)" }}>
                    +66
                  </span>
                  <input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    placeholder="81 234 5678"
                    maxLength={18}
                    disabled={sending}
                    autoComplete="tel"
                    className="mono flex-1 bg-transparent border-0 outline-none text-[16px]"
                    style={{ color: "var(--white)" }}
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setPhoneError(false);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                  />
                </div>
                {phoneError && (
                  <p className="mt-[7px] text-[12.5px]" style={{ color: "var(--danger)" }}>
                    กรุณากรอกเบอร์มือถือไทยให้ถูกต้อง เช่น 081 234 5678
                  </p>
                )}
              </div>

              <div className="mt-[22px]">
                <PrimaryButton loading={sending} onClick={handleSendOtp}>
                  ส่งรหัส OTP
                </PrimaryButton>
              </div>
              </>)}
            </div>
          )}

          {step === "otp" && (
            <div className="flex flex-col">
              <h1 className="text-[1.4rem]">กรอกรหัสยืนยัน</h1>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--steel)" }}>
                เราส่งรหัส 6 หลักไปที่{" "}
                <strong className="mono" style={{ color: "var(--white)", fontWeight: 500 }}>
                  {sentPhone}
                </strong>
              </p>

              <div className="mt-6">
                <label className="block text-[12.5px] mb-2" style={{ color: "var(--steel)" }}>
                  รหัส OTP
                </label>
                <OtpInput disabled={verifying || sending} value={otp} onChange={(next) => { setOtp(next); setOtpError(false); }} onEnter={handleVerifyOtp} />
                {otpError && (
                  <p className="mt-[7px] text-[12.5px]" style={{ color: "var(--danger)" }}>
                    กรอกรหัสให้ครบ 6 หลักก่อนยืนยัน
                  </p>
                )}
              </div>

              <div className="mt-[22px]">
                <PrimaryButton loading={verifying} disabled={sending} onClick={handleVerifyOtp}>
                  ยืนยัน
                </PrimaryButton>
              </div>

              <p className="mt-[18px] text-center text-[13px]" style={{ color: "var(--steel)" }}>
                {resendSeconds > 0 ? (
                  <>
                    ขอรหัสใหม่ได้ใน <span className="mono">{resendLabel}</span>
                  </>
                ) : (
                  <button
                    type="button"
                    className="border-0 bg-transparent p-0 text-[13px] font-medium cursor-pointer"
                    style={{ color: "var(--cyan)" }}
                    disabled={sending || verifying}
                    onClick={handleSendOtp}
                  >
                    ส่งรหัสอีกครั้ง
                  </button>
                )}
              </p>

              <div className="mt-5 text-center">
                <button
                  type="button"
                  className="inline-flex items-center gap-[5px] border-0 bg-transparent p-0 text-[13px] cursor-pointer"
                  style={{ color: "var(--steel)" }}
                  disabled={sending || verifying}
                  onClick={() => { setStep("phone"); setError(""); setOtpError(false); setResendSeconds(0); }}
                >
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path
                      d="M12.5 4 L6 10 L12.5 16"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  เปลี่ยนเบอร์โทร
                </button>
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="flex flex-col items-center text-center">
              <div
                className="rounded-full flex items-center justify-center mb-[18px]"
                style={{
                  width: 56,
                  height: 56,
                  background: "rgba(79, 201, 122, 0.12)",
                  border: "1px solid rgba(79, 201, 122, 0.35)",
                  color: "var(--good)",
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M5 12.5 L9.5 17 L19 6.5"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h1 className="text-[1.4rem]">{verifyPhone ? "ยืนยันเบอร์โทรสำเร็จ" : "ยินดีต้อนรับสู่ TCS"}</h1>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--steel)" }}>
                เข้าสู่ระบบสำเร็จ — เริ่มเลือกซื้อหรือลงประกาศขายการ์ดได้ทันที
              </p>

              <Link href="/browse" prefetch={false} className="mt-6 w-full rounded-[11px] py-3 no-underline font-semibold" style={{ background: "var(--blue)", color: "#071523" }}>เริ่มเลือกซื้อการ์ด</Link>
              <p className="mt-4 text-[12px]" style={{ color: "var(--steel)" }}>ยืนยันเบอร์โทรแล้ว การยืนยันตัวตนผู้ขายเป็นขั้นตอนแยกต่างหาก</p>
            </div>
          )}
        </div>
      </div>

      <p className="relative z-[1] text-center text-[12px] px-5 pb-7" style={{ color: "var(--steel-dim)" }}>
        อย่าเปิดเผยรหัส OTP ให้ผู้อื่น รวมถึงผู้ที่อ้างว่าเป็นทีมงาน TCS
      </p>
    </>
  );
}
