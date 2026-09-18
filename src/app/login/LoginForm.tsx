"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/icons/BrandMark";
import { DecoField } from "@/components/DecoField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { OtpInput } from "@/components/ui/OtpInput";
import { completeLogin } from "./actions";

type Step = "phone" | "otp" | "success";

export function LoginForm() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState(false);
  const [sending, setSending] = useState(false);

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(30);

  useEffect(() => {
    if (step !== "otp" || resendSeconds <= 0) return;
    const t = setInterval(() => setResendSeconds((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [step, resendSeconds]);

  function handleSendOtp() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8) {
      setPhoneError(true);
      return;
    }
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setStep("otp");
      setResendSeconds(30);
    }, 600);
  }

  async function handleVerifyOtp() {
    const code = otp.join("");
    if (code.length < 6) {
      setOtpError(true);
      return;
    }
    setVerifying(true);
    await completeLogin();
    setTimeout(() => {
      setVerifying(false);
      setStep("success");
    }, 600);
  }

  const resendLabel = `00:${String(resendSeconds).padStart(2, "0")}`;

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
          {step === "phone" && (
            <div className="flex flex-col">
              <h1 className="text-[1.4rem]">เข้าสู่ระบบ TCS</h1>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--steel)" }}>
                ใช้เบอร์โทรศัพท์เดียว เป็นหนึ่งบัญชี — ไม่ต้องตั้งรหัสผ่าน เราจะส่งรหัสยืนยันให้ทาง SMS
              </p>

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
                    maxLength={12}
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
                    กรอกเบอร์โทรศัพท์ให้ครบก่อนดำเนินการต่อ
                  </p>
                )}
              </div>

              <div className="mt-[22px]">
                <PrimaryButton loading={sending} onClick={handleSendOtp}>
                  ส่งรหัส OTP
                </PrimaryButton>
              </div>
            </div>
          )}

          {step === "otp" && (
            <div className="flex flex-col">
              <h1 className="text-[1.4rem]">กรอกรหัสยืนยัน</h1>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--steel)" }}>
                เราส่งรหัส 6 หลักไปที่{" "}
                <strong className="mono" style={{ color: "var(--white)", fontWeight: 500 }}>
                  +66 {phone}
                </strong>
              </p>

              <div className="mt-6">
                <label className="block text-[12.5px] mb-2" style={{ color: "var(--steel)" }}>
                  รหัส OTP
                </label>
                <OtpInput value={otp} onChange={(next) => { setOtp(next); setOtpError(false); }} onEnter={handleVerifyOtp} />
                {otpError && (
                  <p className="mt-[7px] text-[12.5px]" style={{ color: "var(--danger)" }}>
                    กรอกรหัสให้ครบ 6 หลักก่อนยืนยัน
                  </p>
                )}
              </div>

              <div className="mt-[22px]">
                <PrimaryButton loading={verifying} onClick={handleVerifyOtp}>
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
                    onClick={() => {
                      setOtp(["", "", "", "", "", ""]);
                      setResendSeconds(30);
                    }}
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
                  onClick={() => setStep("phone")}
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
              <h1 className="text-[1.4rem]">ยินดีต้อนรับสู่ TCS</h1>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--steel)" }}>
                เข้าสู่ระบบสำเร็จ — เริ่มเลือกซื้อหรือลงประกาศขายการ์ดได้ทันที
              </p>

              <div
                className="mt-[26px] w-full rounded-[13px] p-[18px] text-left"
                style={{ background: "var(--panel-2)", border: "1px solid rgba(95, 212, 255, 0.18)" }}
              >
                <div className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ color: "var(--cyan)" }}>
                    <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.4" />
                    <path
                      d="M6.5 10.2 L9 12.6 L13.5 7.6"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="text-[13.5px] font-medium" style={{ color: "var(--white)" }}>
                    รับป้ายยืนยันตัวตน
                  </span>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: "var(--steel)" }}>
                  ผูกบัญชีธนาคารที่ชื่อตรงกับโปรไฟล์ของคุณ เพื่อรับป้ายยืนยันตัวตนและเปิดสิทธิ์รับเงินจากการขาย ทำตอนนี้หรือทีหลังก็ได้
                </p>
                <div className="mt-[14px] flex gap-[10px]">
                  <Link
                    href="/profile"
                    className="flex-1 text-center no-underline rounded-[9px] py-[10px] text-[13px] font-medium"
                    style={{ background: "var(--blue)", color: "#071523" }}
                  >
                    ยืนยันตอนนี้
                  </Link>
                  <Link
                    href="/browse"
                    className="flex-1 text-center no-underline rounded-[9px] py-[10px] text-[13px] font-medium"
                    style={{ background: "transparent", border: "1px solid rgba(140,147,163,0.25)", color: "var(--steel)" }}
                  >
                    ข้ามไปก่อน
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="relative z-[1] text-center text-[12px] px-5 pb-7" style={{ color: "var(--steel-dim)" }}>
        เอกสารแนวคิดฉบับพรีวิว — ขั้นตอน OTP จำลองไว้เพื่อสาธิตการออกแบบ ยังไม่เชื่อมระบบส่ง SMS จริง
      </p>
    </>
  );
}
