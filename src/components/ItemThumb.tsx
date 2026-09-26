import { cropStyle } from "@/lib/spreadPost";

/** A square thumbnail zoomed in on one circled card, cut out of the post's big photo. */
export function ItemThumb({
  photoUrl,
  item,
  size = 56,
}: {
  photoUrl: string | undefined;
  item: { x: number; y: number; r: number; aspect: number };
  size?: number;
}) {
  return (
    <span
      className="relative flex-shrink-0 overflow-hidden rounded-[10px]"
      style={{ width: size, height: size, background: "var(--panel-2)", border: "1px solid var(--line)" }}
      aria-hidden="true"
    >
      {photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" draggable={false} style={cropStyle(item, item.aspect)} />
      )}
    </span>
  );
}
