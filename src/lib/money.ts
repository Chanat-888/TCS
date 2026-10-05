// Ledger amounts are whole satang (docs/payment-plan.md section 13); order amounts stay whole baht.

/** Smallest withdrawal. ponytail: an open decision in the payment plan, change the number here. */
export const MIN_WITHDRAWAL_BAHT = 100;

/** 1% withdrawal fee, rounded half up. The database does the real calculation; this is only for previews. */
export function withdrawalFeeSatang(amountSatang: number): number {
  return Math.floor((amountSatang + 50) / 100);
}

export function formatSatang(satang: number): string {
  return `฿${(satang / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
