import type { CSSProperties } from "react";
import { notFound, redirect } from "next/navigation";
import { BackHeader } from "@/components/BackHeader";
import { Footer } from "@/components/Footer";
import { getSessionUserId } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/server";
import { formatRelativeTime } from "@/lib/format";
import { BANKS } from "@/lib/bankAccount";
import { PayerEdit, RefundDone, SlipReview } from "./ReviewActions";

const card: CSSProperties = { background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" };
const SELECT = "id, image_path, note, created_at, slip_ref, slip_bank, payer_name, payer_bank, payer_account_hint, order:orders!order_id(order_code, amount, status, payment_deadline_at, seller:profiles!seller_id(display_name)), buyer:profiles!buyer_id(display_name)";

type Row = {
  id: string;
  image_path: string;
  note: string | null;
  created_at: string;
  slip_ref: string | null;
  slip_bank: string | null;
  payer_name: string | null;
  payer_bank: string | null;
  payer_account_hint: string | null;
  order: { order_code: string; amount: number; status: string; payment_deadline_at: string | null; seller: { display_name: string } | null } | null;
  buyer: { display_name: string } | null;
};

export default async function AdminPaymentsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  if (!(await isAdmin(userId))) notFound();

  const supabase = createServiceClient();
  const [{ data: review }, { data: refunds }, { data: recent }] = await Promise.all([
    supabase.from("payment_slips").select(SELECT).eq("status", "review").order("created_at"),
    supabase.from("payment_slips").select(SELECT).eq("status", "refund_due").order("created_at"),
    supabase.from("payment_slips").select(SELECT).eq("status", "accepted").order("decided_at", { ascending: false }).limit(15),
  ]);
  const reviewRows = (review ?? []) as unknown as Row[];
  const refundRows = (refunds ?? []) as unknown as Row[];
  const recentRows = (recent ?? []) as unknown as Row[];

  // Five-minute links to the private slip images.
  const paths = reviewRows.map((r) => r.image_path);
  const { data: signed } = paths.length ? await supabase.storage.from("payment-slips").createSignedUrls(paths, 300) : { data: [] };
  const urlOf = (path: string) => signed?.find((s) => s.path === path)?.signedUrl ?? null;

  return (
    <div style={{ "--wrap-max": "980px" } as CSSProperties}>
      <BackHeader href="/admin" title="ตรวจสลิปชำระเงิน" />
      <main className="py-7 pb-[70px]">
        <div className="wrap">
          <h2 className="text-[1.1rem]">รอตรวจสลิป ({reviewRows.length})</h2>
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--steel)" }}>
            เปิด statement บัญชี B หารายการที่ยอดตรงกับคำสั่งซื้อและเวลาหลังสร้างคำสั่งซื้อ ใส่เลขอ้างอิงของรายการนั้นแล้วกดยืนยัน อย่าเชื่อสลิปอย่างเดียว ถ้าไม่พบรายการเงินเข้า ให้ปฏิเสธสลิป
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {reviewRows.map((r) => {
              const url = urlOf(r.image_path);
              return (
                <div key={r.id} className="flex flex-col gap-3 rounded-2xl p-4" style={card}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="mono text-[14px]">#{r.order?.order_code} · ผู้ซื้อ {r.buyer?.display_name ?? "—"} → ผู้ขาย {r.order?.seller?.display_name ?? "—"}</span>
                    <span className="mono text-[16px]">฿{r.order?.amount.toLocaleString("en-US")} <span className="text-[12px]" style={{ color: "var(--steel)" }}>{r.order?.status}</span></span>
                  </div>
                  <div className="text-[12.5px]" style={{ color: "var(--steel)" }}>
                    ส่งสลิป {formatRelativeTime(r.created_at)}
                    {r.slip_ref ? ` · เลขอ้างอิงในสลิป ${r.slip_ref}${r.slip_bank ? ` (${BANKS[r.slip_bank] ?? r.slip_bank})` : ""}` : " · อ่านคิวอาร์ในสลิปไม่ได้"}
                  </div>
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="สลิปการโอน" style={{ maxWidth: 360, maxHeight: 480, borderRadius: 10 }} />
                  ) : (
                    <span className="text-[12.5px]" style={{ color: "var(--danger)" }}>เปิดรูปไม่ได้</span>
                  )}
                  <SlipReview slipId={r.id} slipBank={r.slip_bank} />
                </div>
              );
            })}
            {reviewRows.length === 0 && <p className="text-[13.5px]" style={{ color: "var(--steel)" }}>ไม่มีสลิปรอตรวจ</p>}
          </div>

          <h2 className="mt-9 text-[1.1rem]">รอคืนเงิน ({refundRows.length})</h2>
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--steel)" }}>
            โอนคืนจากบัญชี B เข้าบัญชีที่ผู้ซื้อใช้ชำระเงินเท่านั้น (ดูจากสลิปหรือ statement) แล้วใส่เลขอ้างอิงการโอนคืน
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {refundRows.map((r) => (
              <div key={r.id} className="flex flex-col gap-3 rounded-2xl p-4" style={card}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="mono text-[14px]">#{r.order?.order_code} · ผู้ซื้อ {r.buyer?.display_name ?? "—"}</span>
                  <span className="mono text-[16px]">คืน ฿{r.order?.amount.toLocaleString("en-US")}</span>
                </div>
                {r.note && <div className="text-[12.5px]" style={{ color: "var(--steel)" }}>เหตุผล: {r.note}</div>}
                <RefundDone slipId={r.id} />
              </div>
            ))}
            {refundRows.length === 0 && <p className="text-[13.5px]" style={{ color: "var(--steel)" }}>ไม่มีรายการรอคืนเงิน</p>}
          </div>

          <h2 className="mt-9 text-[1.1rem]">ยืนยันแล้วล่าสุด ({recentRows.length})</h2>
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--steel)" }}>
            แก้ชื่อ ธนาคาร หรือเลขบัญชีผู้โอนที่พิมพ์ผิดได้ที่นี่ ข้อมูลนี้ใช้เป็นเบาะแสตรวจสอบเท่านั้น รูปสลิปคือหลักฐานจริง
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {recentRows.map((r) => (
              <div key={r.id} className="flex flex-col gap-3 rounded-2xl p-4" style={card}>
                <div className="mono text-[13.5px]">#{r.order?.order_code} · ผู้ซื้อ {r.buyer?.display_name ?? "—"} · ฿{r.order?.amount.toLocaleString("en-US")}</div>
                <PayerEdit slipId={r.id} initial={{ name: r.payer_name ?? "", bank: r.payer_bank ?? "", hint: r.payer_account_hint ?? "" }} />
              </div>
            ))}
            {recentRows.length === 0 && <p className="text-[13.5px]" style={{ color: "var(--steel)" }}>ยังไม่มีสลิปที่ยืนยันแล้ว</p>}
          </div>
        </div>
      </main>
      <Footer note="เครื่องมือแอดมิน — ยืนยันการชำระเงินกับ statement ก่อนทุกครั้ง" />
    </div>
  );
}
