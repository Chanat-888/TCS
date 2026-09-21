"use client";

// Client-only cart, kept in this browser's localStorage. No account/device
// sync and no server order until checkout is built — ponytail: acceptable
// ceiling for "let me pick a few things then pay," revisit if cart needs to
// survive across devices.

export interface CartItem {
  listingId: string;
  name: string;
  setName: string;
  rarity: string;
  photoUrl: string | null;
  price: number;
  sellerId: string;
  sellerName: string;
  sellerVerified: boolean;
}

const KEY = "tcs_cart";
const CHANGE_EVENT = "tcs-cart-change";

// Stable reference for useSyncExternalStore's getServerSnapshot — a fresh
// `[]` literal on every call trips React's "should be cached" loop guard.
export const EMPTY_CART: CartItem[] = [];

// useSyncExternalStore needs the same array reference back when nothing
// changed, so cache the parsed result keyed on the raw string.
let cachedRaw: string | null = null;
let cachedItems: CartItem[] = [];

function read(): CartItem[] {
  if (typeof window === "undefined") return cachedItems;
  const raw = localStorage.getItem(KEY) ?? "[]";
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedItems = JSON.parse(raw);
    } catch {
      cachedItems = [];
    }
  }
  return cachedItems;
}

function write(items: CartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function getCart(): CartItem[] {
  return read();
}

export function isInCart(listingId: string): boolean {
  return read().some((i) => i.listingId === listingId);
}

export function addToCart(item: CartItem) {
  const items = read();
  if (items.some((i) => i.listingId === item.listingId)) return;
  write([...items, item]);
}

export function removeFromCart(listingId: string) {
  write(read().filter((i) => i.listingId !== listingId));
}

export function clearCart() {
  write([]);
}

export function subscribeCart(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
