"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

// Goes back to wherever the user actually came from; `href` is only the fallback
// for pages opened directly (or always, with `exact`, for pages whose history is a payment/redirect loop) (no history) and for open-in-new-tab / copy-link.
export function BackLink({ href, onClick, exact, ...props }: ComponentProps<typeof Link> & { exact?: boolean }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      onClick={(e) => {
        onClick?.(e);
        const plain = e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
        // history.length counts entries from other sites (e.g. Facebook); Navigation API only counts ours.
        const nav = (window as { navigation?: { canGoBack: boolean } }).navigation;
        const canGoBack = nav ? nav.canGoBack : window.history.length > 1;
        if (plain && !exact && canGoBack) {
          e.preventDefault();
          router.back();
        }
      }}
      {...props}
    />
  );
}
