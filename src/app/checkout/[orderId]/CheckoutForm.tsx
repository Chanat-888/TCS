"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { Countdown } from "@/components/Countdown";
import { secondsUntil } from "@/lib/countdown";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ProvinceCombobox } from "@/components/ProvinceCombobox";
import { formatTHB } from "@/lib/format";
import type { PaymentMethod } from "@/lib/supabase/types";
import { payOrder } from "./actions";

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-[14px] first:mt-0">
      <label className="mb-[7px] block text-[12.5px]" style={{ color: "var(--steel)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function CheckoutForm({
  orderId,
  listingName,
  sellerId,
  sellerName,
  amount,
  paymentDeadlineAt,
  isAuctionWin,
}: {
  orderId: string;
  listingName: string;
  sellerId: string;
  sellerName: string;
  amount: number;
  paymentDeadlineAt: string;
  isAuctionWin: boolean;
}) {
  const [recipient, setRecipient] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [province, setProvince] = useState("");
  const [postcode, setPostcode] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("promptpay");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExp, setCardExp] = useState("");
  const [cardCvv, setCardCvv] = useState("");

  const [addressError, setAddressError] = useState(false);
  const [methodError, setMethodError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handlePay() {
    const addressOk = recipient.trim() && phone.trim() && address.trim() && province.trim() && postcode.trim();
    if (!addressOk) {
      setAddressError(true);
      return;
    }
    setAddressError(false);
    if (method === "card" && (!cardNumber.trim() || !cardExp.trim() || !cardCvv.trim())) {
      setMethodError(true);
      return;
    }
    setMethodError(false);

    setSubmitting(true);
    const result = await payOrder(orderId, { recipient, phone, address, province, postcode, method });
    setSubmitting(false);
    if ("error" in result) return;
    setDone(true);
    window.scrollTo({ top: 0 });
  }

  if (done) {
    return (
      <div className="py-10 text-center">
        <div
          className="mx-auto mb-[18px] flex items-center justify-center rounded-full"
          style={{ width: 60, height: 60, background: "rgba(79,201,122,0.12)", border: "1px solid rgba(79,201,122,0.35)", color: "var(--good)" }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12.5 L9.5 17 L19 6.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-[1.6rem]">ชำระเงินสำเร็จ</h1>
        <p className="mx-auto mt-[10px] max-w-[42ch] text-[14.5px] leading-loose" style={{ color: "var(--steel)" }}>
          เงิน <strong style={{ color: "var(--white)" }}>{formatTHB(amount)}</strong> อยู่ในระบบพักเงินของ TCS แล้ว —
          ผู้ขายยังไม่ได้รับเงินจนกว่าคุณจะกดรับการ์ด
        </p>
        <span
          className="mono mt-[18px] inline-flex items-center gap-[7px] rounded-full px-[15px] py-[7px] text-[12.5px]"
          style={{ color: "var(--cyan)", background: "rgba(95,212,255,0.1)", border: "1px solid rgba(95,212,255,0.28)" }}
        >
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="4" fill="currentColor" />
          </svg>
          PAID_HELD
        </span>
        <div className="mt-[26px] rounded-2xl p-[18px] text-left" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
          <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--steel)" }}>
            <strong style={{ color: "var(--white)", fontWeight: 500 }}>ต่อไป:</strong> {sellerName} จะเริ่มแพ็คการ์ดและใส่เลขพัสดุ
            คุณจะได้รับแจ้งเตือนทันทีที่มีการจัดส่ง จากนั้นถ่ายวิดีโอตอนแกะกล่องก่อนกดรับการ์ดทุกครั้ง
          </p>
        </div>
        <div className="mt-[22px] flex flex-wrap justify-center gap-[10px]">
          <Link
            href={`/orders/${orderId}`}
            className="min-w-[160px] flex-1 rounded-[11px] py-3 text-center text-[14px] font-medium no-underline"
            style={{ background: "var(--blue)", color: "#071523" }}
          >
            ดูสถานะคำสั่งซื้อ
          </Link>
          <Link
            href="/browse"
            className="min-w-[160px] flex-1 rounded-[11px] py-3 text-center text-[14px] font-medium no-underline"
            style={{ background: "transparent", border: "1px solid rgba(140,147,163,0.25)", color: "var(--steel)" }}
          >
            กลับหน้าหลัก
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-[14px] rounded-2xl p-4" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
        <div
          className="flex flex-shrink-0 items-center justify-center rounded-[9px]"
          style={{ width: 56, height: 72, background: "var(--panel-2)", border: "1px solid rgba(95,212,255,0.25)" }}
        >
          <svg width="46%" height="46%" viewBox="0 0 64 64" aria-hidden="true">
            <path d="M32 4 L40 28 L64 28 L44 42 L52 64 L32 50 L12 64 L20 42 L0 28 L24 28 Z" fill="var(--cyan)" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-[14.5px] font-medium" style={{ color: "var(--white)" }}>
            {listingName}
          </p>
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--steel)" }}>
            จาก <Link href={`/profile/${sellerId}`} style={{ color: "var(--steel)" }}>{sellerName}</Link>
            {isAuctionWin ? " · คุณชนะการประมูลนี้" : " · ซื้อทันที"}
          </p>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-[11px]" style={{ color: "var(--steel-dim)" }}>
            {isAuctionWin ? "ราคาที่ชนะ" : "ราคาซื้อ"}
          </p>
          <p className="mono mt-[2px] text-[18px]" style={{ color: "var(--white)" }}>
            {formatTHB(amount)}
          </p>
        </div>
      </div>

      <div
        className="mt-[14px] flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-[13px]"
        style={{ background: "rgba(95,212,255,0.06)", border: "1px solid rgba(95,212,255,0.2)" }}
      >
        <p className="max-w-[34ch] text-[12.5px] leading-relaxed" style={{ color: "var(--steel)" }}>
          ชำระเงินภายในเวลาที่กำหนด <strong style={{ color: "var(--white)", fontWeight: 500 }}>มิฉะนั้นคำสั่งซื้อจะถูกยกเลิกอัตโนมัติ</strong> และการ์ดจะถูกประกาศขายใหม่
        </p>
        <div className="mono flex flex-shrink-0 items-center gap-[7px] text-[17px]" style={{ color: "var(--cyan)" }}>
          <span className="rounded-full" style={{ width: 6, height: 6, background: "var(--cyan)", boxShadow: "0 0 8px 1px var(--cyan)" }} />
          <Countdown endsAt={paymentDeadlineAt} initialSeconds={secondsUntil(paymentDeadlineAt)} />
        </div>
      </div>

      <div className="mt-[22px]">
        <h2 className="mb-3 text-[14px] font-medium" style={{ color: "var(--steel)" }}>
          ที่อยู่จัดส่ง
        </h2>
        <div className="rounded-2xl p-[18px]" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
          <Field label="ชื่อผู้รับ">
            <input style={inputStyle} value={recipient} onChange={(e) => { setRecipient(e.target.value); setAddressError(false); }} placeholder="ชื่อ-นามสกุล" />
          </Field>
          <Field label="เบอร์โทรศัพท์">
            <input className="mono" style={inputStyle} value={phone} onChange={(e) => { setPhone(e.target.value); setAddressError(false); }} placeholder="08X-XXX-XXXX" />
          </Field>
          <Field label="ที่อยู่">
            <textarea
              style={{ ...inputStyle, height: "auto", minHeight: 64, padding: "11px 13px", resize: "vertical" }}
              value={address}
              onChange={(e) => { setAddress(e.target.value); setAddressError(false); }}
              placeholder="บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ"
            />
          </Field>
          <div className="mt-[14px] grid grid-cols-2 gap-3 max-[480px]:grid-cols-1">
            <Field label="จังหวัด">
              <ProvinceCombobox
                value={province}
                onChange={(v) => { setProvince(v); setAddressError(false); }}
                inputStyle={inputStyle}
                placeholder="กรุงเทพมหานคร"
              />
            </Field>
            <Field label="รหัสไปรษณีย์">
              <input className="mono" style={inputStyle} value={postcode} onChange={(e) => { setPostcode(e.target.value); setAddressError(false); }} placeholder="10XXX" />
            </Field>
          </div>
          {addressError && (
            <p className="mt-[6px] text-[12px]" style={{ color: "var(--danger)" }}>
              กรอกที่อยู่จัดส่งให้ครบก่อนดำเนินการต่อ
            </p>
          )}
        </div>
      </div>

      <div className="mt-[22px]">
        <h2 className="mb-3 text-[14px] font-medium" style={{ color: "var(--steel)" }}>
          วิธีชำระเงิน
        </h2>
        <div className="rounded-2xl p-[18px]" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
          <div className="flex flex-col gap-[10px]">
            {(
              [
                { key: "promptpay" as const, label: "พร้อมเพย์ (PromptPay)", sub: "สแกน QR ผ่านแอปธนาคารของคุณ" },
                { key: "card" as const, label: "บัตรเครดิต / เดบิต", sub: "Visa, Mastercard, JCB" },
              ]
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => { setMethod(opt.key); setMethodError(false); }}
                className="flex items-center gap-3 rounded-xl px-[15px] py-[14px] text-left"
                style={{
                  background: method === opt.key ? "rgba(95,212,255,0.05)" : "var(--panel-2)",
                  border: `1.5px solid ${method === opt.key ? "var(--cyan)" : "rgba(140,147,163,0.18)"}`,
                }}
              >
                <span
                  className="flex flex-shrink-0 items-center justify-center rounded-full"
                  style={{ width: 18, height: 18, border: `1.5px solid ${method === opt.key ? "var(--cyan)" : "rgba(140,147,163,0.4)"}` }}
                >
                  {method === opt.key && <span className="rounded-full" style={{ width: 9, height: 9, background: "var(--cyan)" }} />}
                </span>
                <div>
                  <p className="text-[14px] font-medium" style={{ color: "var(--white)" }}>
                    {opt.label}
                  </p>
                  <p className="mt-[1px] text-[11.5px]" style={{ color: "var(--steel-dim)" }}>
                    {opt.sub}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {method === "card" && (
            <div className="mt-[14px]">
              <Field label="หมายเลขบัตร">
                <input className="mono" style={inputStyle} value={cardNumber} onChange={(e) => { setCardNumber(e.target.value); setMethodError(false); }} placeholder="XXXX XXXX XXXX XXXX" />
              </Field>
              <div className="mt-[14px] grid grid-cols-2 gap-3">
                <Field label="วันหมดอายุ">
                  <input className="mono" style={inputStyle} value={cardExp} onChange={(e) => { setCardExp(e.target.value); setMethodError(false); }} placeholder="MM/YY" />
                </Field>
                <Field label="CVV">
                  <input className="mono" style={inputStyle} value={cardCvv} onChange={(e) => { setCardCvv(e.target.value); setMethodError(false); }} placeholder="XXX" />
                </Field>
              </div>
            </div>
          )}
          {methodError && (
            <p className="mt-[8px] text-[12px]" style={{ color: "var(--danger)" }}>
              กรอกข้อมูลบัตรให้ครบก่อนดำเนินการต่อ
            </p>
          )}
        </div>
      </div>

      <div className="mt-[22px] flex items-start gap-[10px] rounded-xl px-4 py-[13px]" style={{ background: "rgba(95,212,255,0.06)", border: "1px solid rgba(95,212,255,0.2)" }}>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ color: "var(--cyan)", flexShrink: 0, marginTop: 1 }}>
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.4" />
          <path d="M6.5 10.2 L9 12.6 L13.5 7.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="text-[13px] leading-relaxed" style={{ color: "var(--steel)" }}>
          <strong style={{ color: "var(--white)", fontWeight: 500 }}>เงินของคุณจะเข้าระบบพักเงินของ TCS ก่อน</strong> ผู้ขายจะยังไม่ได้รับเงินจนกว่าคุณจะกดรับการ์ด
          หรือครบกำหนดเวลาอนุมัติอัตโนมัติ
        </p>
      </div>

      <div className="mt-[22px] flex items-baseline justify-between pt-4" style={{ borderTop: "1px solid rgba(140,147,163,0.14)" }}>
        <span className="text-[14px] font-medium" style={{ color: "var(--white)" }}>
          ยอดชำระทั้งหมด
          <span className="mt-[3px] block text-[11.5px] font-normal" style={{ color: "var(--steel-dim)" }}>
            ไม่มีค่าธรรมเนียมเพิ่มเติมในช่วงเปิดตัว
          </span>
        </span>
        <span className="mono text-[24px]" style={{ color: "var(--white)" }}>
          {formatTHB(amount)}
        </span>
      </div>

      <div className="mt-[18px]">
        <PrimaryButton height={52} loading={submitting} onClick={handlePay}>
          ชำระเงินตอนนี้
        </PrimaryButton>
      </div>
    </>
  );
}
