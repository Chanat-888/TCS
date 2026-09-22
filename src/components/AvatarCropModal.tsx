"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

const VIEWPORT = 260; // on-screen crop circle, in CSS px
const OUTPUT_SIZE = 512; // exported square photo, in real px
const MAX_ZOOM = 3;

/** A square/circular crop step before a picked photo is uploaded, so an odd
 * aspect ratio or a huge phone photo never has to be sent or stored as-is —
 * closer to how LINE's own profile picture picker works. */
export function AvatarCropModal({
  file,
  uploading = false,
  onCancel,
  onCropped,
}: {
  file: File;
  /** True while the parent's upload request is still in flight, so the
   * confirm button keeps showing a spinner after cropping finishes. */
  uploading?: boolean;
  onCancel: () => void;
  onCropped: (file: File) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    // Creation and revocation are intentionally paired inside one effect. Dev
    // Strict Mode runs an effect, its cleanup, then the effect again on mount;
    // splitting create (e.g. into useMemo) from revoke would let that cleanup
    // revoke the one and only URL with nothing re-creating it, breaking the
    // image that's still trying to load it.
    const url = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const drag = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  function baseScale(w: number, h: number) {
    return VIEWPORT / Math.min(w, h);
  }

  function clamp(nextOffset: { x: number; y: number }, nextZoom: number, size: { w: number; h: number }) {
    const scale = baseScale(size.w, size.h) * nextZoom;
    const displayedW = size.w * scale;
    const displayedH = size.h * scale;
    return {
      x: Math.min(0, Math.max(nextOffset.x, VIEWPORT - displayedW)),
      y: Math.min(0, Math.max(nextOffset.y, VIEWPORT - displayedH)),
    };
  }

  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    const scale = baseScale(w, h);
    setNatural({ w, h });
    setOffset({ x: (VIEWPORT - w * scale) / 2, y: (VIEWPORT - h * scale) / 2 });
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!natural) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startY: e.clientY, originX: offset.x, originY: offset.y };
  }
  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current || !natural) return;
    const next = { x: drag.current.originX + (e.clientX - drag.current.startX), y: drag.current.originY + (e.clientY - drag.current.startY) };
    setOffset(clamp(next, zoom, natural));
  }
  function handlePointerUp() {
    drag.current = null;
  }

  function handleZoom(nextZoom: number) {
    if (!natural) return;
    setZoom(nextZoom);
    setOffset((prev) => clamp(prev, nextZoom, natural));
  }

  async function confirm() {
    if (!natural || !src) return;
    setBusy(true);
    try {
      const img = new Image();
      img.src = src;
      await img.decode();
      const scale = baseScale(natural.w, natural.h) * zoom;
      const sourceSize = VIEWPORT / scale;
      const sourceX = -offset.x / scale;
      const sourceY = -offset.y / scale;

      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      ctx.drawImage(img, sourceX, sourceY, sourceSize, sourceSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) throw new Error("toBlob failed");
      onCropped(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
    } catch {
      setLoadError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto px-5 py-8" style={{ background: "rgba(5, 7, 10, 0.72)" }}>
      <div role="dialog" aria-modal="true" aria-labelledby="crop-dialog-title" className="w-full rounded-[18px] text-left" style={{ maxWidth: 380, background: "var(--panel)", border: "1px solid rgba(140,147,163,0.18)", padding: "26px 22px" }}>
        <h2 id="crop-dialog-title" className="text-[1.2rem]">ปรับตำแหน่งรูป</h2>
        <p className="mt-1 text-[13px]" style={{ color: "var(--steel)" }}>ลากรูปเพื่อเลื่อน และใช้แถบเลื่อนเพื่อซูม</p>

        {loadError ? (
          <p role="alert" className="mt-4 text-[13px]" style={{ color: "var(--danger)" }}>โหลดรูปไม่สำเร็จ กรุณาลองใหม่ด้วยไฟล์อื่น</p>
        ) : (
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="relative mx-auto mt-4 overflow-hidden rounded-full touch-none select-none"
            style={{ width: VIEWPORT, height: VIEWPORT, background: "var(--panel-2)", border: "2px solid rgba(95,212,255,0.35)", cursor: natural ? "grab" : "default" }}
          >
            {src && (
              // eslint-disable-next-line @next/next/no-img-element -- a local object URL of the user's own picked file, not a remote/CDN image
              <img
                src={src}
                alt=""
                draggable={false}
                onLoad={handleImageLoad}
                onError={() => setLoadError(true)}
                style={
                  natural
                    ? { position: "absolute", left: offset.x, top: offset.y, width: natural.w * baseScale(natural.w, natural.h) * zoom, height: natural.h * baseScale(natural.w, natural.h) * zoom, maxWidth: "none" }
                    : { display: "none" }
                }
              />
            )}
          </div>
        )}

        {natural && !loadError && (
          <div className="mt-4 flex items-center gap-3">
            <span className="text-[12px]" style={{ color: "var(--steel)" }}>ซูม</span>
            <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={zoom} disabled={busy} onChange={(e) => handleZoom(Number(e.target.value))} className="flex-1" />
          </div>
        )}

        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onCancel} disabled={busy || uploading} className="h-[46px] flex-1 cursor-pointer rounded-[11px] text-[14px] disabled:opacity-40" style={{ background: "transparent", border: "1px solid rgba(140,147,163,0.3)", color: "var(--steel)" }}>
            ยกเลิก
          </button>
          <div className="flex-1">
            <PrimaryButton type="button" height={46} loading={busy || uploading} disabled={!natural || loadError} onClick={confirm}>
              ใช้รูปนี้
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  );
}
