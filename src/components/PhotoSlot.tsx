"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PhotoAdjustModal } from "@/components/PhotoAdjustModal";
import { prepareCardPhoto } from "@/lib/clientImage";

/**
 * One card photo: tap to pick, rotate/crop, remove. Used when creating a listing and when
 * editing one; while editing, `existingUrl` is the photo already on the listing, shown until the
 * seller picks a replacement (removing the replacement brings the original back).
 */
export function PhotoSlot({
  label,
  file,
  onPick,
  onRemove,
  existingUrl,
  required = true,
}: {
  label: string;
  file: File | null;
  onPick: (f: File) => void;
  onRemove: () => void;
  existingUrl?: string | null;
  /** Shows the red asterisk; false for an optional photo. */
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const [pickError, setPickError] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  // One preview URL per picked file (not one per render, which would also reload the image),
  // and the previous one is released when the file changes.
  const objectUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  const lastUrl = useRef<string | null>(null);
  useEffect(() => {
    const previous = lastUrl.current;
    lastUrl.current = objectUrl;
    if (previous && previous !== objectUrl) URL.revokeObjectURL(previous);
  }, [objectUrl]);

  const preview = objectUrl ?? existingUrl ?? null;
  // Rotate/crop re-encodes through a canvas, which would flatten a GIF/WebP to a
  // still frame — so it's hidden for those rather than silently killing the animation.
  const canAdjust = file ? file.type !== "image/gif" && file.type !== "image/webp" : false;

  // Shrink to a normal JPEG before it ever reaches the form (a big phone photo
  // would otherwise exceed the upload size limit and freeze the request).
  async function handleFile(picked: File) {
    setPreparing(true);
    setPickError("");
    const result = await prepareCardPhoto(picked);
    setPreparing(false);
    if (!result.ok) {
      setPickError(result.error);
      return;
    }
    onPick(result.file);
  }

  const glass = { background: "rgba(10,12,16,0.75)", backdropFilter: "blur(6px)", border: "1px solid rgba(140,147,163,0.25)", color: "var(--white)" } as const;

  return (
    <div>
      <p className="mb-2 text-[12.5px]" style={{ color: "var(--steel)" }}>
        {label} {required && <span style={{ color: "var(--danger)" }}>*</span>}
      </p>
      <div className="relative" style={{ aspectRatio: "5 / 6.2" }}>
        {!preview ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 overflow-hidden rounded-[13px]"
            style={{ border: "1.5px dashed rgba(140,147,163,0.28)" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: "var(--steel)" }}>
              <path d="M12 16V4M12 4l-4 4M12 4l4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
            <p className="px-[10px] text-center text-[12px]" style={{ color: preparing ? "var(--cyan)" : "var(--steel)" }}>
              {preparing ? "กำลังเตรียมรูป…" : <>แตะเพื่ออัปโหลดรูป{label}</>}
            </p>
          </button>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-[13px]" style={{ background: "var(--panel-2)", border: "1.5px solid rgba(95,212,255,0.35)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt={label} className="h-full w-full object-cover" />
            {canAdjust && (
              <button type="button" onClick={() => setAdjusting(true)} className="absolute bottom-2 left-2 flex min-h-11 items-center rounded-lg px-3 text-[12.5px]" style={glass}>
                ↻ หมุน / ตัด
              </button>
            )}
            {existingUrl && !file && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={preparing}
                className="absolute bottom-2 left-2 flex min-h-11 items-center rounded-lg px-3 text-[12.5px]"
                style={glass}
              >
                {preparing ? "กำลังเตรียมรูป…" : "เปลี่ยนรูป"}
              </button>
            )}
            {file && (
              <button
                type="button"
                onClick={onRemove}
                aria-label={existingUrl ? `ใช้รูป${label}เดิม` : `ลบรูป${label}`}
                className="absolute right-2 top-2 flex items-center justify-center rounded-lg"
                style={{ ...glass, width: 26, height: 26, color: "var(--steel)" }}
              >
                <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const picked = e.target.files?.[0];
            e.target.value = "";
            if (picked) handleFile(picked);
          }}
        />
      </div>
      {pickError && (
        <p className="mt-2 text-[12px]" style={{ color: "var(--danger)" }}>
          {pickError}
        </p>
      )}
      {adjusting && file && (
        <PhotoAdjustModal
          file={file}
          onCancel={() => setAdjusting(false)}
          onDone={(result) => {
            setAdjusting(false);
            onPick(result.file);
          }}
        />
      )}
    </div>
  );
}
