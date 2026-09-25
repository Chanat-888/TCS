"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { BIO_MAX, NAME_MAX } from "@/lib/profileName";
import { updateProfile } from "./actions";

const fieldStyle = {
  background: "var(--panel-2)",
  border: "1px solid var(--line)",
  color: "var(--white)",
} as const;

export function EditProfileButton({
  displayName,
  bio,
  highlight = false,
  avatarEditor,
}: {
  displayName: string;
  bio: string;
  highlight?: boolean;
  /** Rendered above the name field — a server component streamed in from the
   * parent, so the picture picker can read the session without this client
   * component needing to. */
  avatarEditor?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(displayName);
  const [about, setAbout] = useState(bio);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  function show() {
    setName(displayName);
    setAbout(bio);
    setError("");
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !saving && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving]);

  async function save() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await updateProfile(name, about);
      if (result.error) setError(result.error);
      else setOpen(false);
    } catch {
      setError("เชื่อมต่อไม่ได้ กรุณาลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={show}
        className="inline-flex flex-shrink-0 cursor-pointer items-center gap-[7px] min-h-11 rounded-[10px] px-[18px] text-[13.5px] font-medium max-[640px]:mt-1"
        style={{
          background: highlight ? "var(--blue)" : "var(--panel)",
          border: "1px solid var(--cyan-line)",
          color: highlight ? "#071523" : "var(--white)",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M13.5 3.5 L16.5 6.5 L7 16 L3.5 16.5 L4 13 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
        แก้ไขโปรไฟล์
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center px-5"
          style={{ background: "rgba(5, 7, 10, 0.72)" }}
          onMouseDown={(e) => e.target === e.currentTarget && !saving && setOpen(false)}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-profile-title"
            className="w-full rounded-[18px] text-left"
            style={{ maxWidth: 420, background: "var(--panel)", border: "1px solid var(--line)", padding: "28px 24px" }}
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <h2 id="edit-profile-title" className="text-[1.2rem]">แก้ไขโปรไฟล์</h2>

            {avatarEditor && (
              <div className="mt-4 flex flex-col items-center gap-2">
                {avatarEditor}
                <p className="text-[12px]" style={{ color: "var(--steel)" }}>แตะรูปเพื่อเปลี่ยนรูปโปรไฟล์</p>
              </div>
            )}

            <p className="mt-4 text-[13px] leading-relaxed" style={{ color: "var(--steel)" }}>
              ชื่อนี้จะแสดงกับผู้ซื้อ ผู้ขาย และในรีวิวของคุณ
            </p>

            {error && <p role="alert" className="mt-4 text-[13px]" style={{ color: "var(--danger)" }}>{error}</p>}

            <label className="mt-5 block text-[12.5px]" style={{ color: "var(--steel)" }} htmlFor="profile-name">ชื่อที่แสดง</label>
            <input
              id="profile-name"
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={NAME_MAX}
              disabled={saving}
              autoComplete="nickname"
              className="mt-2 h-[46px] w-full rounded-[11px] px-[14px] text-[15px] outline-none"
              style={fieldStyle}
            />

            <label className="mt-4 block text-[12.5px]" style={{ color: "var(--steel)" }} htmlFor="profile-bio">แนะนำตัว (ไม่บังคับ)</label>
            <textarea
              id="profile-bio"
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              maxLength={BIO_MAX}
              disabled={saving}
              rows={3}
              className="mt-2 w-full resize-none rounded-[11px] px-[14px] py-3 text-[14px] leading-relaxed outline-none"
              style={fieldStyle}
            />
            <p className="mono mt-1 text-right text-[11px]" style={{ color: "var(--steel)" }}>{Array.from(about).length} / {BIO_MAX}</p>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={saving}
                className="h-[46px] flex-1 cursor-pointer rounded-[11px] text-[14px] disabled:opacity-40"
                style={{ background: "transparent", border: "1px solid var(--line-strong)", color: "var(--steel)" }}
              >
                ยกเลิก
              </button>
              <div className="flex-1">
                <PrimaryButton type="submit" height={46} loading={saving}>บันทึก</PrimaryButton>
              </div>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
