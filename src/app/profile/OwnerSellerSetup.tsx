import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { COMMISSION_RATE } from "@/lib/commission";
import { SetupStep, type StepState } from "@/components/SetupStep";
import { IdentityCheckForm } from "./IdentityCheck";
import { PayoutAccount } from "./PayoutAccount";

/** Private: render only after the verified session user is the profile owner. */
export async function OwnerSellerSetup({ userId }: { userId: string }) {
  const supabase = createServiceClient();
  const [{ data: check, error }, { data: account, error: accountError }] = await Promise.all([
    supabase.from("seller_verifications").select("status, legal_name, reject_reason").eq("user_id", userId).maybeSingle(),
    supabase.from("seller_payout_accounts").select("bank_brand, account_last4, account_name, name_checked_at").eq("user_id", userId).not("account_number_enc", "is", null).maybeSingle(),
  ]);
  if (error || accountError) {
    // Never let this take the whole profile page down (e.g. migration not applied yet).
    console.error("[profile] seller setup unavailable", (error ?? accountError)?.code);
    return null;
  }

  const idState: StepState = check?.status === "approved" ? "done" : check?.status === "submitted" ? "wait" : check?.status === "rejected" ? "bad" : "todo";
  const nameState: StepState = account?.name_checked_at ? "done" : "todo";
  const remaining = [idState, account ? "done" : "todo", nameState].filter((s) => s !== "done").length;

  return (
    <section className="wrap py-6">
      <div className="max-w-md rounded-2xl p-5" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[1.15rem]">การรับเงินของผู้ขาย</h2>
          <span
            className="flex-shrink-0 rounded-full px-3 py-[5px] text-[12.5px] font-medium"
            style={remaining === 0 ? { background: "var(--cyan-tint)", border: "1px solid var(--cyan-line)", color: "var(--cyan)" } : { border: "1px solid var(--line)", color: "var(--steel)" }}
          >
            {remaining === 0 ? "ถอนเงินได้" : `เหลือ ${remaining} ขั้นก่อนถอน`}
          </span>
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--steel)" }}>
          ขายได้เลยโดยไม่ต้องยืนยัน แต่ต้องทำครบ 3 ขั้นนี้ก่อนถอนเงินครั้งแรก
        </p>

        <ol className="mt-5 list-none p-0">
          <SetupStep
            n={1}
            state={idState}
            title="ยืนยันตัวตน"
            note={
              idState === "done" ? `${check?.legal_name} · ได้เครื่องหมายผู้ขายยืนยันตัวตน`
              : idState === "wait" ? "ส่งแล้ว รอทีมงานตรวจสอบ (รูปจะถูกลบทันทีหลังตรวจเสร็จ)"
              : idState === "bad" ? `ไม่ผ่านการตรวจ${check?.reject_reason ? `: ${check.reject_reason}` : ""} ส่งรูปใหม่ได้`
              : "ส่งรูปบัตรประชาชนเพื่อรับเครื่องหมายผู้ขายยืนยันตัวตน"
            }
          >
            {(idState === "todo" || idState === "bad") && <IdentityCheckForm />}
          </SetupStep>

          <PayoutAccount
            saved={account ? { bank_brand: account.bank_brand, account_last4: account.account_last4, account_name: account.account_name } : null}
          />

          <SetupStep
            n={3}
            last
            state={nameState}
            title="ตรวจชื่อบัญชีธนาคาร"
            note={nameState === "done" ? "ตรวจแล้ว ถอนเงินได้" : account ? "รอทีมงานตรวจชื่อบัญชี" : "ทีมงานตรวจชื่อบัญชีให้ตรงกับบัตรหลังคุณเพิ่มบัญชีรับเงิน"}
          />
        </ol>

        <p className="mt-5 pt-4 text-[12.5px] leading-relaxed" style={{ borderTop: "1px solid var(--line-soft)", color: "var(--steel)" }}>
          ผู้ซื้อรับสินค้าแล้ว เงินเข้ากระเป๋ารายได้ (หักค่าธรรมเนียม {Math.round(COMMISSION_RATE * 100)}%) แล้วกดถอนเข้าบัญชีที่ลงไว้ (ค่าถอน 1%){" "}
          <Link href="/earnings" className="whitespace-nowrap font-medium no-underline" style={{ color: "var(--cyan)" }}>ดูรายได้และถอนเงิน →</Link>
        </p>
      </div>
    </section>
  );
}
