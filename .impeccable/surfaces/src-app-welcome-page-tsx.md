---
version: 1
slug: "src-app-welcome-page-tsx"
primary_target: "src/app/welcome/page.tsx"
related_targets: []
---

# Welcome (first login) — surface brief

Scope: `/welcome`, shown once after a new account's first sign-in (profiles.onboarded_at is null), replayable from the profile page. Mode: Operate (inside the app, not marketing).

Audience: new TCS account, usually a Vanguard player coming from Facebook auction groups, on a phone. Job: understand in under a minute why TCS is safe and how buying/selling works, then start browsing. Primary action: ดูการ์ด (browse); secondary: ลงขายการ์ด. Constraints from user: short, not ad-like, not plain, skip always obvious. No claims about fees/providers/tier names (undecided).

## Direction contract

THESIS: The tutorial is a hand of TCS cards: each lesson is a card you flip face-up, so learning the site feels like handling the thing it trades. Refuses the category default of an illustration-plus-paragraph carousel.

OWN-WORLD: Existing TCS world: #0A0C10 ground, panel #171C25 card faces with cyan-line border, circuit-glow card back reused from the landing CardObject, blue primary button, cyan dots, gold only on the final "ready" card glyph. Space Grotesk headings, Inter body, mono only for ฿ amounts and timers.

STORY: Card 1 what TCS is (money waits with TCS) → 2 buying (bid, anti-snipe, pay 24h) → 3 receiving (unboxing video, approve or dispute in 48h) → 4 selling (photos lock at first bid) → 5 ready (set name, browse / sell). User understands the escrow promise and taps ดูการ์ด.

FIRST VIEWPORT: Phone portrait. Top bar: TCS mark left, ข้าม right. Center: one card at real card ratio (~62vw, max 300px), two card-backs offset behind it. The current card flips from back to face on arrival. Below: 5 dots, then a full-width ถัดไป button pinned in thumb reach.

FORM: A hand of TCS cards, #2 on my ordered list, seed key dfde9660.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
