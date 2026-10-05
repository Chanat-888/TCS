import type { CSSProperties } from "react";
import { notFound, redirect } from "next/navigation";
import { BackHeader } from "@/components/BackHeader";
import { Footer } from "@/components/Footer";
import { getSessionUserId } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/secretBox";
import { BANKS } from "@/lib/bankAccount";
import { formatRelativeTime } from "@/lib/format";
import { AccountNameConfirm, IdentityReview } from "./ReviewActions";

const card: CSSProperties = { background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" };
const name = (row: { seller: unknown }) => (row.seller as { display_name: string } | null)?.display_name ?? "—";

export default async function AdminSellersPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  if (!(await isAdmin(userId))) notFound();

  const supabase = createServiceClient();
  const [{ data: submitted }, { data: accounts }] = await Promise.all([
    supabase
      .from("seller_verifications")
      .select("user_id, selfie_path, card_path, submitted_at, seller:profiles!user_id(display_name)")
      .eq("status", "submitted")
      .order("submitted_at"),
    supabase
      .from("seller_payout_accounts")
      .select("user_id, bank_brand, account_number_enc, account_name, seller:profiles!user_id(display_name)")
      .is("name_checked_at", null)
      .not("account_number_enc", "is", null),
  ]);

  // Five-minute links to the private images; they are deleted as soon as the admin decides.
  const paths = (submitted ?? []).flatMap((s) => [s.selfie_path, s.card_path]).filter((p): p is string => Boolean(p));
  const { data: signed } = paths.length ? await supabase.storage.from("id-checks").createSignedUrls(paths, 300) : { data: [] };
  const urlOf = (path: string | null) => signed?.find((s) => s.path === path)?.signedUrl ?? null;

  const accountIds = (accounts ?? []).map((a) => a.user_id);
  const { data: approved } = accountIds.length
    ? await supabase.from("seller_verifications").select("user_id, legal_name").eq("status", "approved").in("user_id", accountIds)
    : { data: [] };
  const legalName = new Map((approved ?? []).map((v) => [v.user_id, v.legal_name]));
  const toCheck = (accounts ?? []).filter((a) => legalName.has(a.user_id));

  return (
    <div style={{ "--wrap-max": "980px" } as CSSProperties}>
      <BackHeader href="/admin" title="ยืนยันตัวตนผู้ขาย" />
      <main className="py-7 pb-[70px]">
        <div className="wrap">
          <h2 className="text-[1.1rem]">รอตรวจตัวตน ({submitted?.length ?? 0})</h2>
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--steel)" }}>
            ดูว่าใบหน้าตรงกับบัตร บัตรไม่หมดอายุและดูเป็นของจริง แล้วพิมพ์ชื่อตามบัตร รูปจะถูกลบทันทีเมื่อคุณกดตัดสิน ห้ามบันทึกหรือแคปรูปเก็บไว้
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {(submitted ?? []).map((s) => (
              <div key={s.user_id} className="flex flex-col gap-3 rounded-2xl p-4" style={card}>
                <div className="text-[14px] font-medium">{name(s)} <span className="text-[12.5px] font-normal" style={{ color: "var(--steel)" }}>· {formatRelativeTime(s.submitted_at)}</span></div>
                <div className="flex flex-wrap gap-3">
                  {[urlOf(s.selfie_path), urlOf(s.card_path)].map((url, i) =>
                    url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={url} alt={i === 0 ? "เซลฟี่คู่บัตร" : "หน้าบัตร"} style={{ maxWidth: 360, maxHeight: 300, borderRadius: 10 }} />
                    ) : (
                      <span key={i} className="text-[12.5px]" style={{ color: "var(--danger)" }}>เปิดรูปไม่ได้</span>
                    ),
                  )}
                </div>
                <IdentityReview userId={s.user_id} />
              </div>
            ))}
            {(submitted ?? []).length === 0 && <p className="text-[13.5px]" style={{ color: "var(--steel)" }}>ไม่มีคำขอที่รอตรวจ</p>}
          </div>

          <h2 className="mt-9 text-[1.1rem]">รอตรวจชื่อบัญชีธนาคาร ({toCheck.length})</h2>
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--steel)" }}>
            พิมพ์เลขบัญชีในแอปธนาคารของ TCS แล้วดูชื่อเจ้าของบัญชีที่ธนาคารแสดง ถ้าตรงกับชื่อที่ยืนยันให้กดยืนยัน ถ้าไม่ตรง อย่ากดและแจ้งผู้ขายให้เปลี่ยนบัญชี ชื่อที่ผู้ขายพิมพ์เองหรือชื่อในสลิปใช้เป็นหลักฐานไม่ได้
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {toCheck.map((a) => (
              <div key={a.user_id} className="flex flex-col gap-3 rounded-2xl p-4" style={card}>
                <div className="text-[14px] font-medium">{name(a)} · ชื่อที่ยืนยัน: {legalName.get(a.user_id)}</div>
                <div className="mono text-[13px]" style={{ color: "var(--steel)" }}>
                  {BANKS[a.bank_brand] ?? a.bank_brand} · {decrypt(a.account_number_enc)} · ชื่อที่ผู้ขายพิมพ์: {a.account_name}
                </div>
                <AccountNameConfirm userId={a.user_id} />
              </div>
            ))}
            {toCheck.length === 0 && <p className="text-[13.5px]" style={{ color: "var(--steel)" }}>ไม่มีบัญชีที่รอตรวจ</p>}
          </div>
        </div>
      </main>
      <Footer note="เครื่องมือแอดมิน — รูปบัตรถูกลบทันทีหลังตัดสิน" />
    </div>
  );
}
