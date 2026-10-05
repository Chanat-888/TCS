import { createServiceClient } from "@/lib/supabase/server";
import { IdentityCheckForm } from "./IdentityCheck";

/** Private: render only after the verified session user is the profile owner. */
export async function OwnerIdentityCheck({ userId }: { userId: string }) {
  const supabase = createServiceClient();
  const [{ data: check, error }, { data: account }] = await Promise.all([
    supabase.from("seller_verifications").select("status, legal_name, reject_reason").eq("user_id", userId).maybeSingle(),
    supabase.from("seller_payout_accounts").select("name_checked_at").eq("user_id", userId).not("account_number_enc", "is", null).maybeSingle(),
  ]);
  if (error) {
    // Never let this take the whole profile page down (e.g. migration not applied yet).
    console.error("[profile] identity check unavailable", error.code);
    return null;
  }

  const approved = check?.status === "approved";
  return (
    <section className="wrap py-6">
      <div className="max-w-md rounded-2xl p-5" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
        <h2 className="text-[1.15rem]">ยืนยันตัวตนผู้ขาย</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--steel)" }}>
          ขายได้เลยโดยไม่ต้องยืนยัน แต่ต้องยืนยันตัวตนและให้ทีมงานตรวจชื่อบัญชีธนาคารก่อนถอนเงินครั้งแรก ยืนยันแล้วจะได้เครื่องหมายผู้ขายยืนยันตัวตน
        </p>
        {approved ? (
          <p className="mt-4 text-[14px]">
            ยืนยันตัวตนแล้ว · {check.legal_name}
            <span className="block text-[12.5px]" style={{ color: "var(--steel)" }}>
              {account ? (account.name_checked_at ? "ตรวจชื่อบัญชีธนาคารแล้ว ถอนเงินได้" : "รอทีมงานตรวจชื่อบัญชีธนาคาร") : "เพิ่มบัญชีรับเงินด้านล่างเพื่อให้ทีมงานตรวจชื่อ"}
            </span>
          </p>
        ) : check?.status === "submitted" ? (
          <p className="mt-4 text-[14px]">ส่งแล้ว รอทีมงานตรวจสอบ (รูปจะถูกลบทันทีหลังตรวจเสร็จ)</p>
        ) : (
          <>
            {check?.status === "rejected" && (
              <p role="alert" className="mt-4 text-[13px]" style={{ color: "var(--danger)" }}>
                ไม่ผ่านการตรวจ{check.reject_reason ? `: ${check.reject_reason}` : ""} ส่งรูปใหม่ได้
              </p>
            )}
            <IdentityCheckForm />
          </>
        )}
      </div>
    </section>
  );
}
