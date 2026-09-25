export function formatTHB(amount: number): string {
  return `฿${amount.toLocaleString("en-US")}`;
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "เมื่อสักครู่";
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} วันที่แล้ว`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} สัปดาห์ที่แล้ว`;
  const months = Math.floor(days / 30);
  return `${months} เดือนที่แล้ว`;
}

const THAI_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

export function formatThaiMonthYear(iso: string): string {
  const d = new Date(iso);
  return `${THAI_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "27 ก.ย. 18.00 น." in Thai time (UTC+7), whatever the viewer's timezone. */
export function formatThaiDateTime(iso: string, { year = false }: { year?: boolean } = {}): string {
  const d = new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000);
  const time = `${String(d.getUTCHours()).padStart(2, "0")}.${String(d.getUTCMinutes()).padStart(2, "0")} น.`;
  const date = `${d.getUTCDate()} ${THAI_MONTHS[d.getUTCMonth()]}${year ? ` ${d.getUTCFullYear() + 543}` : ""}`;
  return `${date} ${time}`;
}

export function maskUserLabel(id: string): string {
  return `ผู้ใช้ ···${id.replace(/-/g, "").slice(-3)}`;
}
