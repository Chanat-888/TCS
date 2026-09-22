"use client";

import { useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { AvatarCropModal } from "@/components/AvatarCropModal";
import { setAvatarFromProvider, uploadAvatar } from "@/app/profile/accountActions";

type Option = { provider: "line" | "google"; url: string; label: string };

// Cropping always exports a small ~512px JPEG (see AvatarCropModal), so this
// only guards against picking a pathologically huge original to decode.
const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;

/** The owner's big profile picture, hoverable and clickable to open a menu
 * for uploading a photo from their device or switching to a photo one of
 * their linked sign-in providers offers. */
export function AvatarPicker({
  avatarUrl,
  initial,
  options,
  size = 92,
  style,
}: {
  avatarUrl: string | null;
  initial: string;
  options: Option[];
  size?: number;
  style?: CSSProperties;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const busy = useRef(false);

  async function choose(provider: Option["provider"]) {
    if (busy.current) return;
    busy.current = true;
    setPending(provider);
    setError("");
    try {
      const result = await setAvatarFromProvider(provider);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("บันทึกรูปโปรไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = ""; // lets the same file be picked again later
    if (!file) return;
    if (file.size > MAX_ORIGINAL_BYTES) {
      setError("ไฟล์ต้นฉบับใหญ่เกินไป (ไม่เกิน 25 MB) กรุณาเลือกรูปอื่น");
      return;
    }
    setError("");
    setOpen(false);
    setCropFile(file);
  }

  async function upload(cropped: File) {
    if (busy.current) return;
    busy.current = true;
    setPending("upload");
    setError("");
    try {
      const formData = new FormData();
      formData.set("avatar", cropped);
      const result = await uploadAvatar(formData);
      setCropFile(null);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.refresh();
    } catch {
      setCropFile(null);
      setError("อัปโหลดรูปไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="เปลี่ยนรูปโปรไฟล์"
        aria-expanded={open}
        className="group relative block cursor-pointer rounded-full border-0 bg-transparent p-0"
      >
        <Avatar url={avatarUrl} initial={initial} className="text-[30px] font-bold" style={{ width: size, height: size, border: "2px solid rgba(95,212,255,0.35)", color: "var(--cyan)", ...style }} />
        <span
          className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100"
          style={{ background: "rgba(10,12,16,0.6)" }}
        >
          <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M4 15.5V17h1.5l8.4-8.4-1.5-1.5L4 15.5Zm11.7-8.5a1 1 0 0 0 0-1.4l-1.3-1.3a1 1 0 0 0-1.4 0l-1.1 1.1 2.7 2.7 1.1-1.1Z" fill="#fff" />
          </svg>
        </span>
      </button>

      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFile} />

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-full z-20 mt-2 w-56 rounded-xl p-2"
            style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.2)", boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}
          >
            <p className="mb-1 px-2 pt-1 text-[12px]" style={{ color: "var(--steel)" }}>เปลี่ยนรูปโปรไฟล์</p>

            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={pending !== null}
              className="flex w-full items-center gap-3 rounded-lg p-2 text-left disabled:opacity-50"
            >
              <span className="flex items-center justify-center rounded-full" style={{ width: 32, height: 32, flexShrink: 0, background: "var(--panel-2)", color: "var(--steel)" }}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M10 4v9M6 9.5 10 5.5 14 9.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 15h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </span>
              <span className="flex-1 text-[13px]">{pending === "upload" ? "กำลังอัปโหลด…" : "อัปโหลดรูปจากเครื่อง"}</span>
            </button>

            {options.map((o) => (
              <button
                key={o.provider}
                type="button"
                onClick={() => choose(o.provider)}
                disabled={pending !== null}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left disabled:opacity-50"
                style={{ background: o.url === avatarUrl ? "rgba(95,212,255,0.1)" : "transparent" }}
              >
                <Avatar url={o.url} initial="" style={{ width: 32, height: 32, flexShrink: 0 }} />
                <span className="flex-1 text-[13px]">{pending === o.provider ? "กำลังบันทึก…" : o.label}</span>
                {o.url === avatarUrl && (
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M4 10.5 L8 14.5 L16 5.5" stroke="var(--cyan)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="absolute left-0 top-full mt-1 w-56 text-[12px]" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      {cropFile && <AvatarCropModal file={cropFile} uploading={pending === "upload"} onCancel={() => setCropFile(null)} onCropped={upload} />}
    </div>
  );
}
