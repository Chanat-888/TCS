"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { FULL_RECT, MIN_CROP, clampRect, rotateRectCcw, rotateRectCw, type Rect } from "@/lib/photoEdit";

const PREVIEW_MAX = 340; // longest side of the on-screen preview on a wide screen, in CSS px

export interface AdjustResult {
  file: File;
  /** Clockwise quarter turns applied (0-3), then `crop` (of the turned photo). */
  turns: number;
  crop: Rect;
}

type Mode = "move" | "nw" | "ne" | "sw" | "se";

/**
 * Rotate and crop a photo before it is used: turn it 90° either way, drag the frame
 * to move it, or drag a corner to resize it. The result is a fresh JPEG of at most
 * `maxSide` pixels on its longest side.
 */
export function PhotoAdjustModal({
  file,
  maxSide = 1800,
  quality = 0.85,
  onCancel,
  onDone,
}: {
  file: File;
  maxSide?: number;
  quality?: number;
  onCancel: () => void;
  onDone: (result: AdjustResult) => void;
}) {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [turns, setTurns] = useState(0);
  const [crop, setCrop] = useState<Rect>(FULL_RECT);
  const [busy, setBusy] = useState(false);
  // The preview must fit inside the dialog on a narrow phone (dialog padding and margins
  // take about 100px), otherwise the picture overflows its frame and looks cropped.
  const [previewMax] = useState(() => Math.max(200, Math.min(PREVIEW_MAX, window.innerWidth - 100)));
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: Mode; startX: number; startY: number; rect: Rect } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loaded: ImageBitmap | null = null;
    createImageBitmap(file).then(
      (b) => {
        if (cancelled) return b.close();
        loaded = b;
        setBitmap(b);
      },
      () => !cancelled && setLoadError(true)
    );
    return () => {
      cancelled = true;
      loaded?.close();
    };
  }, [file]);

  // The photo as turned: odd numbers of quarter turns swap its width and height.
  const sideways = turns % 2 === 1;
  const turnedW = bitmap ? (sideways ? bitmap.height : bitmap.width) : 1;
  const turnedH = bitmap ? (sideways ? bitmap.width : bitmap.height) : 1;
  const scale = Math.min(previewMax / turnedW, previewMax / turnedH);
  const shownW = Math.round(turnedW * scale);
  const shownH = Math.round(turnedH * scale);

  useEffect(() => {
    const el = canvas.current;
    if (!el || !bitmap) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = Math.round(shownW * dpr);
    el.height = Math.round(shownH * dpr);
    const ctx = el.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, el.width, el.height);
    ctx.translate(el.width / 2, el.height / 2);
    ctx.rotate((turns * Math.PI) / 2);
    const drawW = (sideways ? el.height : el.width);
    const drawH = (sideways ? el.width : el.height);
    ctx.drawImage(bitmap, -drawW / 2, -drawH / 2, drawW, drawH);
  }, [bitmap, turns, shownW, shownH, sideways]);

  function rotate(direction: 1 | -1) {
    setTurns((t) => (t + direction + 4) % 4);
    setCrop((r) => clampRect(direction === 1 ? rotateRectCw(r) : rotateRectCcw(r)));
  }

  function begin(e: ReactPointerEvent<HTMLElement>, mode: Mode) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { mode, startX: e.clientX, startY: e.clientY, rect: crop };
  }

  function move(e: ReactPointerEvent<HTMLElement>) {
    const d = drag.current;
    const box = stage.current?.getBoundingClientRect();
    if (!d || !box || box.width === 0 || box.height === 0) return;
    const dx = (e.clientX - d.startX) / box.width;
    const dy = (e.clientY - d.startY) / box.height;
    const r = d.rect;
    if (d.mode === "move") {
      setCrop({ ...r, x: Math.min(1 - r.w, Math.max(0, r.x + dx)), y: Math.min(1 - r.h, Math.max(0, r.y + dy)) });
      return;
    }
    // A corner drag moves that corner; the opposite corner stays where it was.
    const west = d.mode === "nw" || d.mode === "sw";
    const north = d.mode === "nw" || d.mode === "ne";
    const left = west ? Math.min(r.x + r.w - MIN_CROP, Math.max(0, r.x + dx)) : r.x;
    const right = west ? r.x + r.w : Math.max(r.x + MIN_CROP, Math.min(1, r.x + r.w + dx));
    const top = north ? Math.min(r.y + r.h - MIN_CROP, Math.max(0, r.y + dy)) : r.y;
    const bottom = north ? r.y + r.h : Math.max(r.y + MIN_CROP, Math.min(1, r.y + r.h + dy));
    setCrop({ x: left, y: top, w: right - left, h: bottom - top });
  }

  function end() {
    drag.current = null;
  }

  async function confirm() {
    if (!bitmap || busy) return;
    setBusy(true);
    try {
      // Turn the whole photo at its real size, then cut the chosen part out of it.
      const full = document.createElement("canvas");
      full.width = turnedW;
      full.height = turnedH;
      const fctx = full.getContext("2d");
      if (!fctx) throw new Error("no canvas");
      fctx.translate(full.width / 2, full.height / 2);
      fctx.rotate((turns * Math.PI) / 2);
      fctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);

      const sx = Math.round(crop.x * turnedW);
      const sy = Math.round(crop.y * turnedH);
      const sw = Math.max(1, Math.round(crop.w * turnedW));
      const sh = Math.max(1, Math.round(crop.h * turnedH));
      const outScale = Math.min(1, maxSide / Math.max(sw, sh));
      const out = document.createElement("canvas");
      out.width = Math.max(1, Math.round(sw * outScale));
      out.height = Math.max(1, Math.round(sh * outScale));
      const octx = out.getContext("2d");
      if (!octx) throw new Error("no canvas");
      octx.fillStyle = "#ffffff";
      octx.fillRect(0, 0, out.width, out.height);
      octx.drawImage(full, sx, sy, sw, sh, 0, 0, out.width, out.height);

      const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/jpeg", quality));
      if (!blob) throw new Error("no blob");
      onDone({ file: new File([blob], "photo.jpg", { type: "image/jpeg" }), turns, crop });
    } catch {
      setBusy(false);
      setLoadError(true);
    }
  }

  const handle = (mode: Mode, style: React.CSSProperties) => (
    <span
      key={mode}
      onPointerDown={(e) => begin(e, mode)}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      aria-hidden="true"
      className="absolute touch-none"
      style={{ width: 30, height: 30, background: "#fff", border: "2px solid var(--blue)", borderRadius: 8, cursor: "nwse-resize", ...style }}
    />
  );

  const iconButton = "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[10px] px-3 text-[13.5px]";
  const iconStyle = { background: "var(--panel-2)", border: "1px solid rgba(140,147,163,0.2)", color: "var(--white)" };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto px-4 py-6" style={{ background: "rgba(5, 7, 10, 0.78)" }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="adjust-dialog-title"
        className="w-full rounded-[18px] text-left"
        style={{ maxWidth: 420, background: "var(--panel)", border: "1px solid rgba(140,147,163,0.18)", padding: "22px 18px" }}
      >
        <h2 id="adjust-dialog-title" className="text-[1.15rem]">หมุน / ตัดรูป</h2>
        <p className="mt-1 text-[13px]" style={{ color: "var(--steel)" }}>
          กดปุ่มหมุนรูป ลากกรอบเพื่อเลื่อน หรือลากมุมเพื่อปรับขนาดพื้นที่ที่จะใช้
        </p>

        {loadError ? (
          <p role="alert" className="mt-4 text-[13px]" style={{ color: "var(--danger)" }}>
            ปรับรูปนี้ไม่สำเร็จ กรุณาลองใหม่ด้วยรูปอื่น
          </p>
        ) : (
          <>
            <div className="mt-4 flex justify-center">
              <div
                ref={stage}
                className="relative flex-shrink-0 touch-none select-none overflow-hidden"
                style={{ width: shownW, height: shownH, background: "var(--panel-2)", borderRadius: 8 }}
              >
                <canvas ref={canvas} style={{ width: shownW, height: shownH, display: "block" }} />
                {bitmap && (
                  <div
                    onPointerDown={(e) => begin(e, "move")}
                    onPointerMove={move}
                    onPointerUp={end}
                    onPointerCancel={end}
                    className="absolute touch-none"
                    style={{
                      left: `${crop.x * 100}%`,
                      top: `${crop.y * 100}%`,
                      width: `${crop.w * 100}%`,
                      height: `${crop.h * 100}%`,
                      border: "2px solid #fff",
                      boxShadow: "0 0 0 9999px rgba(5,7,10,0.62)",
                      cursor: "move",
                    }}
                  >
                    {handle("nw", { left: -13, top: -13 })}
                    {handle("ne", { right: -13, top: -13, cursor: "nesw-resize" })}
                    {handle("sw", { left: -13, bottom: -13, cursor: "nesw-resize" })}
                    {handle("se", { right: -13, bottom: -13 })}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => rotate(-1)} disabled={!bitmap} className={iconButton} style={iconStyle} aria-label="หมุนซ้าย 90 องศา">
                ↺ หมุนซ้าย
              </button>
              <button type="button" onClick={() => rotate(1)} disabled={!bitmap} className={iconButton} style={iconStyle} aria-label="หมุนขวา 90 องศา">
                ↻ หมุนขวา
              </button>
              <button type="button" onClick={() => setCrop(FULL_RECT)} disabled={!bitmap} className={iconButton} style={iconStyle}>
                รีเซ็ตกรอบ
              </button>
            </div>
          </>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="min-h-12 flex-1 rounded-[11px] text-[14px]"
            style={{ background: "var(--panel-2)", border: "1px solid rgba(140,147,163,0.2)", color: "var(--steel)" }}
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!bitmap || busy || loadError}
            className="min-h-12 flex-[1.4] rounded-[11px] text-[14.5px] font-semibold disabled:opacity-60"
            style={{ background: "var(--blue)", color: "#071523" }}
          >
            {busy ? "กำลังบันทึก…" : "ใช้รูปนี้"}
          </button>
        </div>
      </div>
    </div>
  );
}
