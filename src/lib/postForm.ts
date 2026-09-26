/**
 * POSTs a form and always resolves: a network failure, or a non-JSON reply (for
 * example the platform rejecting an oversized body with an HTML error page), becomes
 * a readable message instead of an exception that would leave the UI stuck loading.
 */
export async function postForm<T = Record<string, unknown>>(
  url: string,
  formData: FormData,
  method: "POST" | "PATCH" = "POST"
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  let res: Response;
  try {
    res = await fetch(url, { method, body: formData });
  } catch {
    return { ok: false, status: 0, error: "เชื่อมต่อไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง" };
  }
  let json: Record<string, unknown> = {};
  try {
    json = await res.json();
  } catch {
    // not JSON
  }
  if (!res.ok) {
    const error =
      typeof json.error === "string"
        ? json.error
        : res.status === 413
          ? "ไฟล์ที่อัปโหลดใหญ่เกินไป"
          : "เกิดข้อผิดพลาดจากเซิร์ฟเวอร์ ลองอีกครั้ง (ถ้าอัปโหลดรูปหรือวิดีโอ อาจใหญ่เกินไป)";
    return { ok: false, status: res.status, error };
  }
  return { ok: true, data: json as T };
}
