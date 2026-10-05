"use client";

import { useState } from "react";
import { confirmAccountName, decideIdentity } from "./actions";

const input = { height: 36, background: "var(--panel-2)", border: "1px solid var(--line)", color: "var(--white)" };
const primary = { height: 36, background: "var(--blue)", color: "var(--ink-on-blue)" };

export function IdentityReview({ userId }: { userId: string }) {
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function decide(approve: boolean) {
    setBusy(true);
    setError("");
    const result = await decideIdentity(userId, approve, name, reason);
    setBusy(false);
    if ("error" in result) setError(result.error ?? "");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input className="rounded-lg px-3 text-[13px]" style={{ ...input, width: 260 }} placeholder="ชื่อ-นามสกุลตามบัตร (เมื่ออนุมัติ)" aria-label="ชื่อ-นามสกุลตามบัตร" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="button" disabled={busy} onClick={() => decide(true)} className="rounded-lg border-0 px-3 text-[13px] font-semibold cursor-pointer" style={primary}>อนุมัติ</button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input className="rounded-lg px-3 text-[13px]" style={{ ...input, width: 260 }} placeholder="เหตุผลที่ไม่ผ่าน (เมื่อปฏิเสธ)" aria-label="เหตุผลที่ไม่ผ่าน" value={reason} onChange={(e) => setReason(e.target.value)} />
        <button type="button" disabled={busy} onClick={() => decide(false)} className="rounded-lg border-0 px-3 text-[13px] cursor-pointer" style={{ height: 36, background: "transparent", color: "var(--danger)" }}>ไม่ผ่าน</button>
      </div>
      {error && <span role="alert" className="text-[12.5px]" style={{ color: "var(--danger)" }}>{error}</span>}
    </div>
  );
}

export function AccountNameConfirm({ userId }: { userId: string }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    setError("");
    const result = await confirmAccountName(userId);
    setBusy(false);
    if ("error" in result) setError(result.error ?? "");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={busy} onClick={confirm} className="rounded-lg border-0 px-3 text-[13px] font-semibold cursor-pointer" style={primary}>ชื่อที่ธนาคารแสดงตรงกัน</button>
      {error && <span role="alert" className="text-[12.5px]" style={{ color: "var(--danger)" }}>{error}</span>}
    </div>
  );
}
