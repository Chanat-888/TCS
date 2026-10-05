/** Platform commission taken from every sale. Change this number to change the rate. */
export const COMMISSION_RATE = 0.09;

/** Whole baht, since order amounts are whole baht. */
export function splitPayout(amount: number) {
  const commission = Math.round(amount * COMMISSION_RATE);
  return { commission, payout: amount - commission };
}
