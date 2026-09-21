import { Avatar } from "./Avatar";
import { Stars } from "./Stars";

export function ReviewItem({
  raterInitial,
  raterAvatarUrl,
  raterName,
  rating,
  date,
  text,
  tags,
  orderLabel,
  isFirst,
}: {
  raterInitial: string;
  raterAvatarUrl?: string | null;
  raterName: string;
  rating: number;
  date: string;
  text?: string | null;
  tags?: string[];
  orderLabel: string;
  isFirst?: boolean;
}) {
  return (
    <div
      className="flex gap-[14px] py-[18px] text-left"
      style={!isFirst ? { borderTop: "1px solid rgba(140,147,163,0.1)" } : undefined}
    >
      <Avatar
        url={raterAvatarUrl}
        initial={raterInitial}
        className="text-[13px] font-semibold"
        style={{ width: 38, height: 38, color: "var(--steel)" }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-[10px]">
          <span className="text-[13.5px] font-medium" style={{ color: "var(--white)" }}>
            {raterName}
          </span>
          <Stars value={rating} />
          <span className="mono ml-auto text-[12px]" style={{ color: "var(--steel-dim)" }}>
            {date}
          </span>
        </div>
        {text && (
          <p className="mt-[6px] text-[14px] leading-relaxed" style={{ color: "var(--steel)" }}>
            {text}
          </p>
        )}
        {tags && tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-[6px]">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full px-[9px] py-[3px] text-[11px]"
                style={{ color: "var(--cyan)", background: "rgba(95,212,255,0.08)", border: "1px solid rgba(95,212,255,0.2)" }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <p className="mono mt-[6px] text-[11.5px]" style={{ color: "var(--steel-dim)" }}>
          ออเดอร์ · {orderLabel}
        </p>
      </div>
    </div>
  );
}
