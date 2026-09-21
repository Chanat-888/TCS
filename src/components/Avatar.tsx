"use client";

import { useState, type CSSProperties } from "react";
import { trustedAvatarUrl } from "@/lib/avatar";

/** Round profile picture that falls back to the initial when there is no
 * trusted photo URL or the image fails to load. */
export function Avatar({
  url,
  initial,
  className = "",
  style,
}: {
  url?: string | null;
  initial: string;
  className?: string;
  style?: CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  const src = failed ? null : trustedAvatarUrl(url);
  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full ${className}`}
      style={{ background: "var(--panel-2)", fontFamily: "var(--font-display)", ...style }}
    >
      {src ? (
        // Decorative: the person's name is always shown next to the picture.
        // Plain <img>: tiny avatars already served from the provider's CDN, so
        // next/image would only add remotePatterns config and optimizer cost.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initial
      )}
    </div>
  );
}
