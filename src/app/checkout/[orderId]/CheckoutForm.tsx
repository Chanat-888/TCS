"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Countdown } from "@/components/Countdown";
import { secondsUntil } from "@/lib/countdown";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ProvinceCombobox } from "@/components/ProvinceCombobox";
import { formatTHB } from "@/lib/format";
import { MAX_ADDRESSES, type SavedAddress } from "@/lib/addresses";
import type { PaymentMethod } from "@/lib/supabase/types";
import { checkPayment, payOrder, type DeliveryChoice } from "./actions";

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

type DeliveryKind = "saved" | "other" | "meetup";

function ChoiceCard({ selected, onSelect, title, sub }: { selected: boolean; onSelect: () => void; title: string; sub: string }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex items-center gap-3 rounded-xl px-[15px] py-[14px] text-left"
      style={{
        background: selected ? "rgba(95,212,255,0.05)" : "var(--panel-2)",
        border: `1.5px solid ${selected ? "var(--cyan)" : "rgba(140,147,163,0.18)"}`,
      }}
    >
      <span
        className="flex flex-shrink-0 items-center justify-center rounded-full"
        style={{ width: 18, height: 18, border: `1.5px solid ${selected ? "var(--cyan)" : "rgba(140,147,163,0.4)"}` }}
      >
        {selected && <span className="rounded-full" style={{ width: 9, height: 9, background: "var(--cyan)" }} />}
      </span>
      <div>
        <p className="text-[14px] font-medium" style={{ color: "var(--white)" }}>{title}</p>
        <p className="mt-[1px] text-[11.5px]" style={{ color: "var(--steel-dim)" }}>{sub}</p>
      </div>
    </button>
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
  savedAddresses,
}: {
  orderId: string;
  listingName: string;
  sellerId: string;
  sellerName: string;
  amount: number;
  paymentDeadlineAt: string;
  isAuctionWin: boolean;
  savedAddresses: SavedAddress[];
}) {
  const defaultSaved = savedAddresses.find((a) => a.is_default) ?? savedAddresses[0];
  const [delivery, setDelivery] = useState<DeliveryKind>(defaultSaved ? "saved" : "other");
  const [savedId, setSavedId] = useState(defaultSaved?.id ?? "");
  const [saveNew, setSaveNew] = useState(true);
  const [recipient, setRecipient] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [province, setProvince] = useState("");
  const [postcode, setPostcode] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("promptpay");
  const [walletPhone, setWalletPhone] = useState("");
  const [qr, setQr] = useState<null | { url: string; delivery: "ship" | "meetup" }>(null);

  const [addressError, setAddressError] = useState("");
  const [methodError, setMethodError] = useState(false);
  const [payError, setPayError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<null | "ship" | "meetup">(null);

  const canSaveNew = savedAddresses.length < MAX_ADDRESSES;

  // While the PromptPay QR is up, ask the server every few seconds whether Omise
  // has seen the payment (the webhook may also get there first).
  useEffect(() => {
    if (!qr) return;
    const timer = setInterval(async () => {
      const status = await checkPayment(orderId).catch(() => "pending" as const);
      if (status === "paid") {
        setQr(null);
        setDone(qr.delivery);
        window.scrollTo({ top: 0 });
      } else if (status === "failed") {
        setQr(null);
        setPayError("QR หมดอายุหรือชำระไม่สำเร็จ กดชำระเงินเพื่อสร้าง QR ใหม่");
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [qr, orderId]);

  async function handlePay() {
    setPayError("");
    let choice: DeliveryChoice;
    if (delivery === "meetup") {
      choice = { type: "meetup" };
    } else if (delivery === "saved") {
      if (!savedId) {
        setAddressError("เลือกที่อยู่จัดส่งก่อนดำเนินการต่อ");
        return;
      }
      choice = { type: "saved", addressId: savedId };
    } else {
      if (!(recipient.trim() && phone.trim() && address.trim() && province.trim() && postcode.trim())) {
        setAddressError("กรอกที่อยู่จัดส่งให้ครบก่อนดำเนินการต่อ");
        return;
      }
      choice = { type: "other", address: { recipient, phone, address, province, postcode }, save: saveNew && canSaveNew };
    }
    setAddressError("");
    if (method === "truemoney" && !/^0\d{9}$/.test(walletPhone.replace(/\D/g, ""))) {
      setMethodError(true);
      return;
    }
    setMethodError(false);

    setSubmitting(true);
    try {
      const result = await payOrder(orderId, { method, delivery: choice, walletPhone });
      if ("error" in result) {
        // Address problems are shown next to the address; anything else at the button.
        setPayError(result.error ?? "ชำระเงินไม่สำเร็จ ลองอีกครั้ง");
        return;
      }
      if (result.authorizeUri) {
        // TrueMoney: OTP on Omise's page, which returns to /checkout/[orderId].
        window.location.assign(result.authorizeUri);
        return;
      }
      if (!result.qrUrl) {
        setPayError("เริ่มการชำระเงินไม่สำเร็จ ลองอีกครั้ง");
        return;
      }
      setQr({ url: result.qrUrl, delivery: result.deliveryMethod });
      window.scrollTo({ top: 0 });
    } catch {
      setPayError("เชื่อมต่อไม่ได้ กรุณาลองอีกครั้ง");
    } finally {
      setSubmitting(false);
    }
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
            <strong style={{ color: "var(--white)", fontWeight: 500 }}>ต่อไป:</strong>{" "}
            {done === "meetup"
              ? <>นัดสถานที่และเวลากับ {sellerName} ในแชทของคำสั่งซื้อ แนะนำให้นัดในที่สาธารณะ และถ่ายวิดีโอแกะกล่องต่อหน้าก่อนกดรับการ์ดทุกครั้ง</>
              : <>{sellerName} จะเริ่มแพ็คการ์ดและใส่เลขพัสดุ คุณจะได้รับแจ้งเตือนทันทีที่มีการจัดส่ง จากนั้นถ่ายวิดีโอตอนแกะกล่องก่อนกดรับการ์ดทุกครั้ง</>}
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

  if (qr) {
    return (
      <div className="py-6 text-center">
        <h1 className="text-[1.4rem]">สแกนเพื่อชำระเงิน</h1>
        <p className="mt-2 text-[13.5px]" style={{ color: "var(--steel)" }}>
          เปิดแอปธนาคาร สแกน QR พร้อมเพย์ แล้วชำระ <strong style={{ color: "var(--white)" }}>{formatTHB(amount)}</strong>
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element -- Omise-hosted QR, not a static asset */}
        <img src={qr.url} alt="QR พร้อมเพย์สำหรับชำระเงิน" className="mx-auto mt-5 rounded-xl bg-white p-3" style={{ width: 260, maxWidth: "100%" }} />
        <p className="mt-4 text-[12.5px]" role="status" style={{ color: "var(--steel-dim)" }}>
          รอการยืนยันการชำระเงิน… หน้านี้จะเปลี่ยนเองเมื่อชำระสำเร็จ
        </p>
        <button type="button" onClick={() => setQr(null)} className="mt-5 text-[13px] underline" style={{ color: "var(--steel)" }}>
          เปลี่ยนวิธีชำระเงิน
        </button>
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
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-[14px] font-medium" style={{ color: "var(--steel)" }}>
            วิธีรับสินค้า
          </h2>
          <Link href="/profile" className="text-[12px]" style={{ color: "var(--cyan)" }}>จัดการที่อยู่ในโปรไฟล์</Link>
        </div>
        <div className="rounded-2xl p-[18px]" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
          <div className="flex flex-col gap-[10px]">
            {savedAddresses.length > 0 && (
              <ChoiceCard selected={delivery === "saved"} onSelect={() => { setDelivery("saved"); setAddressError(""); }} title="ส่งไปที่อยู่ที่บันทึกไว้" sub="เลือกจากที่อยู่ในโปรไฟล์ของคุณ" />
            )}
            <ChoiceCard selected={delivery === "other"} onSelect={() => { setDelivery("other"); setAddressError(""); }} title={savedAddresses.length > 0 ? "ส่งไปที่อยู่อื่น" : "กรอกที่อยู่จัดส่ง"} sub="กรอกที่อยู่สำหรับคำสั่งซื้อนี้" />
            <ChoiceCard selected={delivery === "meetup"} onSelect={() => { setDelivery("meetup"); setAddressError(""); }} title="นัดรับสินค้า" sub="นัดสถานที่และเวลากับผู้ขายในแชท ไม่ต้องกรอกที่อยู่" />
          </div>

          {delivery === "saved" && (
            <div className="mt-[14px] flex flex-col gap-[10px]" role="radiogroup" aria-label="ที่อยู่ที่บันทึกไว้">
              {savedAddresses.map((a) => (
                <label
                  key={a.id}
                  className="flex cursor-pointer items-start gap-3 rounded-xl px-[15px] py-[13px]"
                  style={{ background: savedId === a.id ? "rgba(95,212,255,0.05)" : "var(--panel-2)", border: `1px solid ${savedId === a.id ? "var(--cyan)" : "rgba(140,147,163,0.18)"}` }}
                >
                  <input type="radio" name="saved-address" checked={savedId === a.id} onChange={() => { setSavedId(a.id); setAddressError(""); }} className="mt-1" />
                  <span className="text-[13px] leading-relaxed" style={{ color: "var(--steel)" }}>
                    <strong style={{ color: "var(--white)", fontWeight: 500 }}>{a.label}</strong>
                    {a.is_default && <span className="ml-2 text-[11px]" style={{ color: "var(--cyan)" }}>ค่าเริ่มต้น</span>}
                    <br />
                    {a.recipient} · <span className="mono">{a.phone}</span>
                    <br />
                    {a.address} {a.province} <span className="mono">{a.postcode}</span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {delivery === "other" && (
            <div className="mt-[14px]">
              <Field label="ชื่อผู้รับ">
                <input style={inputStyle} value={recipient} onChange={(e) => { setRecipient(e.target.value); setAddressError(""); }} placeholder="ชื่อ-นามสกุล" autoComplete="name" />
              </Field>
              <Field label="เบอร์โทรศัพท์">
                <input className="mono" style={inputStyle} value={phone} onChange={(e) => { setPhone(e.target.value); setAddressError(""); }} placeholder="08X-XXX-XXXX" inputMode="tel" autoComplete="tel" />
              </Field>
              <Field label="ที่อยู่">
                <textarea
                  style={{ ...inputStyle, height: "auto", minHeight: 64, padding: "11px 13px", resize: "vertical" }}
                  value={address}
                  onChange={(e) => { setAddress(e.target.value); setAddressError(""); }}
                  placeholder="บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ"
                />
              </Field>
              <div className="mt-[14px] grid grid-cols-2 gap-3 max-[480px]:grid-cols-1">
                <Field label="จังหวัด">
                  <ProvinceCombobox
                    value={province}
                    onChange={(v) => { setProvince(v); setAddressError(""); }}
                    inputStyle={inputStyle}
                    placeholder="กรุงเทพมหานคร"
                  />
                </Field>
                <Field label="รหัสไปรษณีย์">
                  <input className="mono" style={inputStyle} value={postcode} onChange={(e) => { setPostcode(e.target.value.replace(/\D/g, "")); setAddressError(""); }} placeholder="10XXX" inputMode="numeric" maxLength={5} autoComplete="postal-code" />
                </Field>
              </div>
              {canSaveNew && (
                <label className="mt-[14px] flex cursor-pointer items-center gap-2 text-[13px]" style={{ color: "var(--steel)" }}>
                  <input type="checkbox" checked={saveNew} onChange={(e) => setSaveNew(e.target.checked)} />
                  บันทึกที่อยู่นี้ไว้ในโปรไฟล์ของฉัน
                </label>
              )}
            </div>
          )}

          {delivery === "meetup" && (
            <div className="mt-[14px] rounded-xl px-4 py-[13px] text-[13px] leading-relaxed" style={{ background: "rgba(232,184,79,0.06)", border: "1px solid rgba(232,184,79,0.25)", color: "var(--steel)" }}>
              <strong style={{ color: "var(--white)", fontWeight: 500 }}>ยังมีระบบพักเงินเหมือนเดิม</strong> เงินอยู่กับ TCS จนกว่าคุณจะกดรับการ์ด
              แนะนำให้นัดในที่สาธารณะ และถ่ายวิดีโอแกะกล่องต่อหน้าก่อนกดรับ เพราะเป็นหลักฐานเดียวหากมีข้อพิพาท
            </div>
          )}

          {addressError && (
            <p role="alert" className="mt-[10px] text-[12px]" style={{ color: "var(--danger)" }}>
              {addressError}
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
                { key: "truemoney" as const, label: "TrueMoney Wallet", sub: "ยืนยันด้วยรหัส OTP ที่ส่งไปยังเบอร์ TrueMoney" },
              ]
            ).map((opt) => (
              <ChoiceCard key={opt.key} selected={method === opt.key} onSelect={() => { setMethod(opt.key); setMethodError(false); }} title={opt.label} sub={opt.sub} />
            ))}
          </div>

          {method === "truemoney" && (
            <div className="mt-[14px]">
              <Field label="เบอร์ TrueMoney Wallet">
                <input className="mono" style={inputStyle} value={walletPhone} onChange={(e) => { setWalletPhone(e.target.value); setMethodError(false); }} placeholder="08X-XXX-XXXX" inputMode="tel" autoComplete="tel" />
              </Field>
            </div>
          )}
          {methodError && (
            <p className="mt-[8px] text-[12px]" style={{ color: "var(--danger)" }}>
              กรอกเบอร์ TrueMoney 10 หลักก่อนดำเนินการต่อ
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

      {payError && (
        <p role="alert" className="mt-[14px] text-[13px]" style={{ color: "var(--danger)" }}>
          {payError}
        </p>
      )}
      <div className="mt-[18px]">
        <PrimaryButton height={52} loading={submitting} onClick={handlePay}>
          ชำระเงินตอนนี้
        </PrimaryButton>
      </div>
    </>
  );
}
