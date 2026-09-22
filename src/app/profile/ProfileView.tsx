import { AccountSignInMethods } from "@/components/AccountSignInMethods";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import type { ProfileData } from "@/lib/profile";
import { formatThaiMonthYear } from "@/lib/format";
import { Footer } from "@/components/Footer";
import { Stars } from "@/components/Stars";
import { ReviewItem } from "@/components/ReviewItem";
import { ProductCard } from "@/components/ProductCard";
import { DEFAULT_DISPLAY_NAME } from "@/lib/profileName";
import { Avatar } from "@/components/Avatar";
import { EditProfileButton } from "./EditProfileButton";
import { DisputeTile, OwnerDisputeTile } from "./OwnerDisputeTile";
import { AddressBookSkeleton, OwnerAddressBook } from "./OwnerAddressBook";
import { OwnerAvatarEditor } from "./OwnerAvatarEditor";

/** viewerId must come from the verified server session, never request input.
 * data is passed as a promise so callers can load it while the session is verified. */
export async function ProfileView({ id, viewerId, data }: { id: string; viewerId: string; data: Promise<ProfileData> }) {
  const { profile, stats, reviews, listings, everBid } = await data;
  if (!profile) notFound();
  const isOwner = viewerId === id;

  const achievements = [
    { name: "ประมูลครั้งแรก", unlocked: everBid },
    { name: "ขายครั้งแรก", unlocked: stats.completedSales >= 1 },
    { name: "ปิดดีลครบ 100 ครั้ง", unlocked: stats.completedSales >= 100, progress: stats.completedSales, target: 100 },
    { name: "ปิดดีลครบ 500 ครั้ง", unlocked: stats.completedSales >= 500, progress: stats.completedSales, target: 500 },
  ];
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const needsName = isOwner && profile.display_name === DEFAULT_DISPLAY_NAME;

  const editIcon = (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M13.5 3.5 L16.5 6.5 L7 16 L3.5 16.5 L4 13 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );

  return (
    <div>
      <header
        className="sticky top-0 z-50"
        style={{
          background: "rgba(10, 12, 16, 0.78)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderBottom: "1px solid rgba(140, 147, 163, 0.1)",
        }}
      >
        <div className="wrap flex items-center gap-[14px] py-[14px]">
          <Link
            href="/browse"
            aria-label="ย้อนกลับ"
            className="flex flex-shrink-0 items-center justify-center rounded-[10px] no-underline"
            style={{ width: 40, height: 40, background: "var(--panel)", border: "1px solid rgba(140,147,163,0.2)", color: "var(--steel)" }}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M12.5 4 L6 10 L12.5 16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16 }}>
            {isOwner ? "โปรไฟล์ของฉัน" : profile.display_name}
          </span>
        </div>
      </header>

      <main>
        <section className="pb-2 pt-9">
          <div className="wrap">
            <div className="flex items-start gap-6 max-[640px]:flex-col max-[640px]:items-center max-[640px]:text-center">
              <div className="relative flex-shrink-0">
                {isOwner ? (
                  <Suspense
                    fallback={
                      <Avatar url={profile.avatar_url} initial={profile.avatar_initial} className="text-[30px] font-bold" style={{ width: 92, height: 92, border: "2px solid rgba(95,212,255,0.35)", color: "var(--cyan)" }} />
                    }
                  >
                    <OwnerAvatarEditor avatarUrl={profile.avatar_url} initial={profile.avatar_initial} />
                  </Suspense>
                ) : (
                  <Avatar
                    url={profile.avatar_url}
                    initial={profile.avatar_initial}
                    className="text-[30px] font-bold"
                    style={{ width: 92, height: 92, border: "2px solid rgba(95,212,255,0.35)", color: "var(--cyan)" }}
                  />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-[10px] max-[640px]:justify-center">
                  <h1 className="text-[1.5rem]">{profile.display_name}</h1>
                </div>

                <div className="mt-[10px] flex flex-wrap gap-2 max-[640px]:justify-center">
                  {profile.verified && (
                    <span
                      className="inline-flex items-center gap-[6px] rounded-full px-3 py-[5px] text-[12.5px] font-medium"
                      style={{ background: "rgba(95,212,255,0.1)", border: "1px solid rgba(95,212,255,0.3)", color: "var(--cyan)" }}
                    >
                      <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.4" />
                        <path d="M6.5 10.2 L9 12.6 L13.5 7.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      ยืนยันตัวตนแล้ว
                    </span>
                  )}
                  {profile.tier && (
                    <span
                      className="inline-flex items-center gap-[6px] rounded-full px-3 py-[5px] text-[12.5px] font-medium"
                      style={{ background: "rgba(232,184,79,0.1)", border: "1px solid rgba(232,184,79,0.3)", color: "var(--gold)" }}
                    >
                      <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path d="M10 2 L12.2 7.4 L18 8 L13.6 11.8 L15 17.5 L10 14.2 L5 17.5 L6.4 11.8 L2 8 L7.8 7.4 Z" fill="currentColor" />
                      </svg>
                      {profile.tier}
                    </span>
                  )}
                </div>

                {needsName && (
                  <p className="mt-[10px] text-[13px]" style={{ color: "var(--gold)" }}>
                    ตั้งชื่อที่แสดงของคุณ เพื่อให้ผู้ซื้อและผู้ขายรู้ว่าเป็นใคร
                  </p>
                )}

                {profile.bio && (
                  <p className="mt-[14px] max-w-[56ch] text-[14.5px] leading-relaxed max-[640px]:max-w-none" style={{ color: "var(--steel)" }}>
                    {profile.bio}
                  </p>
                )}
                <p className="mono mt-[10px] text-[12.5px]" style={{ color: "var(--steel-dim)" }}>
                  เข้าร่วมเมื่อ {formatThaiMonthYear(profile.created_at)}
                </p>
              </div>

              {isOwner && <EditProfileButton displayName={profile.display_name} bio={profile.bio} highlight={needsName} />}
            </div>
          </div>
        </section>

        <section className="pb-2 pt-7">
          <div className="wrap">
            <div
              className="grid gap-px overflow-hidden rounded-2xl max-[720px]:grid-cols-2"
              style={{ gridTemplateColumns: "repeat(4, 1fr)", background: "rgba(140,147,163,0.12)", border: "1px solid rgba(140,147,163,0.12)" }}
            >
              <div className="px-5 py-[18px]" style={{ background: "var(--panel)" }}>
                <div className="mono text-[22px]" style={{ color: "var(--cyan)" }}>
                  {stats.completedSales}
                </div>
                <div className="mt-1 text-[12px]" style={{ color: "var(--steel)" }}>
                  ปิดการขายแล้ว
                </div>
              </div>
              {isOwner && (
                <Suspense fallback={<DisputeTile count={null} />}>
                  <OwnerDisputeTile userId={id} />
                </Suspense>
              )}
              <div className="px-5 py-[18px]" style={{ background: "var(--panel)" }}>
                <div className="mono text-[22px]" style={{ color: "var(--white)" }}>
                  {stats.avgRating.toFixed(1)} <span style={{ fontSize: 13, color: "var(--steel)" }}>/ 5</span>
                </div>
                <div className="mt-1 text-[12px]" style={{ color: "var(--steel)" }}>
                  คะแนนรีวิวเฉลี่ย ({stats.reviewCount} รีวิว)
                </div>
              </div>
              <div className="px-5 py-[18px]" style={{ background: "var(--panel)" }}>
                <div className="mono text-[22px]" style={{ color: "var(--white)" }}>
                  {formatThaiMonthYear(profile.created_at)}
                </div>
                <div className="mt-1 text-[12px]" style={{ color: "var(--steel)" }}>
                  เข้าร่วม TCS
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap">
            <div className="mb-[18px] flex items-baseline justify-between gap-3">
              <h2 className="text-[1.15rem]">ความสำเร็จ</h2>
              <span className="mono text-[12.5px]" style={{ color: "var(--steel)" }}>
                {unlockedCount} / {achievements.length} ปลดล็อกแล้ว
              </span>
            </div>
            <div className="grid grid-cols-4 gap-[14px] max-[900px]:grid-cols-2">
              {achievements.map((a) => (
                <div key={a.name} className="flex flex-col gap-[10px] rounded-2xl p-4" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.12)" }}>
                  <div
                    className="flex items-center justify-center rounded-[10px]"
                    style={{ width: 38, height: 38, background: a.unlocked ? "rgba(95,212,255,0.12)" : "rgba(140,147,163,0.1)", color: a.unlocked ? "var(--cyan)" : "var(--steel-dim)" }}
                  >
                    <svg width="19" height="19" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path d="M10 2 L12.2 7.4 L18 8 L13.6 11.8 L15 17.5 L10 14.2 L5 17.5 L6.4 11.8 L2 8 L7.8 7.4 Z" fill="currentColor" />
                    </svg>
                  </div>
                  <p className="text-[13.5px] font-medium" style={{ color: a.unlocked ? "var(--white)" : "var(--steel)" }}>
                    {a.name}
                  </p>
                  {a.target ? (
                    <>
                      <div className="h-1 overflow-hidden rounded-full" style={{ background: "rgba(140,147,163,0.15)" }}>
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${Math.min(100, ((a.progress ?? 0) / a.target) * 100)}%`, background: a.unlocked ? "var(--cyan)" : "var(--steel-dim)" }}
                        />
                      </div>
                      <p className="mono text-[11px]" style={{ color: a.unlocked ? "var(--cyan)" : "var(--steel-dim)" }}>
                        {a.progress} / {a.target}
                      </p>
                    </>
                  ) : (
                    <p className="mono text-[11px]" style={{ color: a.unlocked ? "var(--cyan)" : "var(--steel-dim)" }}>
                      {a.unlocked ? "ปลดล็อกแล้ว" : "ยังไม่ปลดล็อก"}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap">
            <div className="mb-[18px] flex items-baseline justify-between gap-3">
              <h2 className="text-[1.15rem]">รีวิว</h2>
              <span className="flex items-center gap-2 text-[13px]" style={{ color: "var(--steel)" }}>
                <Stars value={Math.round(stats.avgRating)} />
                {stats.avgRating.toFixed(1)} จาก {stats.reviewCount} รีวิว
              </span>
            </div>
            {reviews.length === 0 ? (
              <p className="text-[13.5px]" style={{ color: "var(--steel)" }}>
                ยังไม่มีรีวิว
              </p>
            ) : (
              <div className="flex flex-col">
                {reviews.map((r, i) => (
                  <ReviewItem
                    key={r.id}
                    isFirst={i === 0}
                    raterInitial={r.rater.avatar_initial}
                    raterAvatarUrl={r.rater.avatar_url}
                    raterName={r.rater.display_name}
                    rating={r.rating}
                    date={formatThaiMonthYear(r.created_at)}
                    text={r.comment}
                    tags={r.tags}
                    orderLabel={r.listing_name}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="section" style={{ paddingBottom: 8 }}>
          <div className="wrap">
            <div className="mb-[18px] flex flex-wrap items-center gap-3">
              <h2 className="text-[1.15rem]">ประกาศขายปัจจุบัน</h2>
              <span className="mono text-[12.5px]" style={{ color: "var(--steel)" }}>
                {listings.length} รายการ
              </span>
              {isOwner && (
                <Link
                  href="/profile/listings"
                  className="ml-auto inline-flex items-center gap-[7px] rounded-[9px] px-4 py-[9px] text-[13px] font-medium no-underline"
                  style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.2)", color: "var(--steel)" }}
                >
                  {editIcon}
                  จัดการประกาศ
                </Link>
              )}
            </div>

            <div className="grid grid-cols-4 gap-[18px] max-[1024px]:grid-cols-3 max-[720px]:grid-cols-2 max-[720px]:gap-3">
              {listings.map((listing) => (
                <ProductCard key={listing.id} listing={listing} ownerEditHref={isOwner ? `/listings/${listing.id}/edit` : undefined} />
              ))}
              {isOwner && (
                <Link
                  href="/listings/new"
                  className="flex min-h-full flex-col items-center justify-center gap-[10px] rounded-2xl no-underline"
                  style={{ border: "1.5px dashed rgba(140,147,163,0.25)", color: "var(--steel)" }}
                >
                  <span className="flex items-center justify-center rounded-full" style={{ width: 40, height: 40, border: "1.5px solid currentColor" }}>
                    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="text-[12.5px] font-medium">เพิ่มประกาศใหม่</span>
                </Link>
              )}
            </div>
          </div>
        </section>
        {isOwner && (
          <Suspense fallback={<AddressBookSkeleton />}>
            <OwnerAddressBook userId={id} />
          </Suspense>
        )}
        {isOwner && <AccountSignInMethods />}
        {isOwner && (
          <form action="/logout" method="post" className="mt-8">
            <button type="submit" className="text-[13px] cursor-pointer" style={{ color: "var(--steel)" }}>
              ออกจากระบบ
            </button>
          </form>
        )}
      </main>

      <Footer note="เอกสารแนวคิดฉบับพรีวิว — ข้อมูลระดับผู้ขายและความสำเร็จเป็นตัวอย่างประกอบการออกแบบ ชื่อระดับและเงื่อนไขจริงยังไม่กำหนด" />
    </div>
  );
}
