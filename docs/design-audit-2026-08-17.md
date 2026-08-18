# Our Sweet Family — Design & UX Audit / Improvement Catalog

**Date:** 2026-08-17 (implementation status appended 2026-08-18)
**Author:** Claude (senior design-engineer review)
**Status:** In progress — the foundational backbone is built, verified, and shipped. See the status block below; remaining IDs are the tracked backlog.
**Scope:** Web app (`client/`), Mobile app (`mobile/`). Special focus: **dark mode**, **landscape**, and overall beauty + functionality, top to bottom.

---

## ✅ Implementation status (2026-08-18)

Shipped to `claude/family-photo-sharing-app-RfJto` (web auto-deploys to Vercel, server to Railway; mobile is JS-live via Metro):

| Batch | IDs delivered | Commit |
|---|---|---|
| **Foundations** | SYS-1, SYS-2, CC-8/DM-2 (muted-text contrast) | `53ec649` |
| **Web dark mode** | DM-0, CC-1, CC-2, DM-1 (web toggle), Clerk dark theming; marketing/auth pages light-committed via `.theme-light` scope | `4031933` |
| **Mobile theme control** | DM-1 (Light/Dark/System selector), DM-3 (44-color audit — all legit over-media/already-dark) | `3e47c80` |
| **A11y + motion base** | CC-6/A11Y-1 (web focus-visible), CC-7 (web reduce-motion), SYS-4 (motion tokens), A11Y-3 (mobile reduce-motion: Ken Burns/cross-fade/splash), M16 (Reels light status bar) | `583dddb` |
| **Web perf** | PF-1 (route code-splitting: 500 kB monolith → 330 kB + per-route chunks) | `8d5ccb8` |
| **Mobile keyboard fix** | M46 + M10/M22/M36 — `<BottomSheet>` primitive (KAV + safe-area) adopted in Milestones/Children/Capture; DatePickerField safe-area inset | `95be0e8` |
| **Web dialogs/toasts** | CC-9, CC-10 — themed `useConfirm()` + `useToast()`, replaced all 6 `window.confirm` + 8 `alert()` | `f57f0a1` |
| **Photo lightbox** | MD-2 (web fullscreen zoom), M30 (mobile real aspect ratio), M32 (mobile pinch-zoom viewer) | `0a34efd` |
| **Scrubber + clearance** | M1 (shared `useTabBarClearance`), M2 (timeline right gutter so tiles clear the scrubber rail) | `81843f7` |
| **Cleanup + a11y labels + input** | CC-4 (deleted dead MemoryCard.jsx), A11Y-2/M61 (aria/accessibilityLabel on icon-only nav/header/action buttons), CC-5 (Upload caption input tokenized + focus ring) | `260da2e`+ |

This covers top-10 items **#1, #2, #3, #4 (base), #5, #6 (web), #7, #9, #10**, and part of **#8**.

**Deliberate scope decisions:** (a) marketing/legal/auth pages render light-only on purpose — a half-dark Sunrise front door is worse than a deliberately light one; (b) mobile video autoplay-on-scroll is *not* gated by Reduce Motion (it's content the user explicitly asked to keep).

**Verification notes:** web build + mobile `tsc` clean on every batch; web dark-mode flip mechanism + marketing light-scope proven in-browser; authed-web dark mode not live-verified (needs a Clerk login, which I don't perform); mobile theme selector verified by clean bundle + launch (the simulator was stuck in landscape, so no portrait screenshot of the selector).

**Remaining backlog (highest-value first):** mobile toast/confirm (M65 — native `Alert.alert` still used; lower priority than the web `window.confirm` now fixed), mobile comment-bar safe-area at rest (M31), per-screen landscape two-column (M7/M25/M69), web icon-system SVG dedup (CC-3 — maintainability only; deferred as a careful cleanup), typography ramp (SYS-3), remaining lower-traffic icon-button labels (reel controls, capture buttons), plus the per-screen P2/P3 items in §2/§3.

## How to read this

Every item has: an **ID**, **surface**, **priority** (P0 blocker → P3 nice-to-have), **effort** (S/M/L), and a concrete recommendation. Cross-cutting foundations come first (they unblock many screen items), then per-screen catalogs, then the dedicated **Dark Mode** and **Landscape** matrices, then a suggested sequencing.

**Priority key:** P0 = broken/blocking or embarrassing; P1 = high user impact; P2 = meaningful polish; P3 = delight/nice-to-have.
**Effort key:** S = <½ day; M = ~1–2 days; L = multi-day / needs design.

---

## 0. North-star principles (the bar we're holding to)

1. **Photo-forward, content-first.** Chrome recedes; memories are the hero. Generous imagery, restrained UI.
2. **One coherent system across web + mobile.** Same Sunrise palette, type ramp, spacing, radii, motion language — so the two feel like one product.
3. **Every state is designed.** Loading, empty, error, offline, permission-denied, and success all have intentional, warm treatments — never a raw spinner or blank.
4. **Motion with meaning.** Gentle, physical, purposeful (Ken Burns, cross-fades, spring presses) — and fully respectful of Reduce Motion.
5. **Beautiful in both themes, every orientation, every screen size.** Dark mode and landscape are first-class, not afterthoughts.
6. **Accessible by default.** AA contrast, real focus states, VoiceOver/keyboard, 44pt targets, Dynamic Type.

---

## 1. Cross-cutting foundations (do these first — they unblock screen work)

### 1.1 Design system / tokens

- **[SYS-1] Web has no shared design-token layer.** (P1, M) Colors, spacing, and type live as ad-hoc Tailwind classes and inline hex. Establish CSS custom properties (`--color-bg`, `--color-surface`, `--text`, `--brand-500`, etc.) in `client/src/index.css`, mirror the mobile `theme/index.ts` semantic roles, and drive Tailwind via `theme.extend` referencing the vars. This is the prerequisite for web dark mode (§2) and for consistency with mobile.
- **[SYS-2] Unify the two token sources.** (P1, M) `mobile/src/theme/index.ts` and the web Tailwind config define the same brand ramp twice. Extract a single JSON/TS token file consumed by both (web via a build step or hand-mirrored, mobile directly) so brand/spacing/radius never drift.
- **[SYS-3] Typography ramp is implicit on web.** (P2, S) Mobile has `typography` variants; web uses raw `text-2xl`/`font-bold`. Define a small semantic type scale (display / title / heading / body / label / caption) as component classes or a `<Text>` primitive so hierarchy is consistent and tunable.
- **[SYS-4] Motion tokens.** (P2, S) No shared durations/easings. Define `--ease-standard`, `--ease-emphasized`, durations (fast 150 / base 250 / slow 400) on web; a `motion.ts` on mobile. Use everywhere for consistency and a single Reduce-Motion switch.

### 1.2 Dark mode (headline gap — see full matrix in §5)

- **[DM-0] Web dark mode is entirely missing.** (P1, L) No `dark:` utilities, no `darkMode` in Tailwind config, no `prefers-color-scheme`. This is the single biggest cross-platform inconsistency: mobile flips with the system, web is always light. Requires SYS-1 first, then a full pass. Details in §5.
- **[DM-1] Mobile: no in-app theme control.** (P2, S) `ThemeProvider` only reads `useColorScheme()`. Add a Light / Dark / System selector in Settings (persisted) so users aren't forced to the OS setting — table stakes for a premium app.
- **[DM-2] Mobile: `textMuted` is identical in light and dark** (`#8890a8` in both). (P2, S) On the dark `#151726` bg it's low-contrast for captions/timestamps. Lighten the dark `textMuted` (~`#9aa1bd`+) and re-check all "caption/textMuted" usages for AA.
- **[DM-3] Mobile: 44 hardcoded `#fff` / `#000` / `rgba(0,0,0…)` / `rgba(255,255,255…)` across ~12 files.** (P1, M) Many are correct (white text/scrims over photos), but audit each: any structural white/black surface (not over media) must move to tokens or it breaks in dark. Files include MediaPicker, GlassView, capture, reels, `_layout` tab bar. Enumerated per-screen in §3/§5.

### 1.3 Accessibility

- **[A11Y-1] Focus-visible states (web).** (P1, M) Verify every interactive element (nav links, chips, icon buttons, the new nav bubble, comment inputs) has a visible keyboard focus ring. Tailwind `focus-visible:` ring utilities, not just `:focus`.
- **[A11Y-2] Icon-only buttons need labels.** (both, S) Web `<UserButton>`-replaced menu, collapse bubble, search/upload icons; mobile header icons, tab bar, reel controls — add `aria-label` / `accessibilityLabel`.
- **[A11Y-3] Reduce Motion.** (both, S) Gate Ken Burns, cross-fades, splash spring, hover scales behind `prefers-reduced-motion` / RN `AccessibilityInfo.isReduceMotionEnabled`.
- **[A11Y-4] Dynamic Type / zoom.** (mobile, M) Type is fixed px in the RN kit; audit for `allowFontScaling` and layout resilience at large text sizes.
- **[A11Y-5] Contrast sweep.** (both, M) Run AA contrast on muted text, chips, gradient-overlaid text, and dark-mode tokens once DM work lands.

### 1.4 Performance

- **[PERF-1] Web bundle >500 kB single chunk.** (P2, M) Vite warns. Route-level `React.lazy` code-splitting (Landing/auth vs app), and split heavy deps (Clerk, date-fns). Improves first paint — compounds the feed-cache work already shipped.
- **[PERF-2] Auth handshake gates first paint (web).** (P1, M) Even with the feed cache, the timeline waits on Clerk → `/auth/me` → `/families` before rendering. Parallelize, cache the last family id, and render the cached feed optimistically before family resolves. (Previously flagged; still open.)
- **[PERF-3] Mobile list virtualization + image memory.** (P2, M) Confirm SectionList windowing on long feeds; ensure `expo-image` cache policy and downscaled thumbnails (server now serves 800px) are used everywhere; cap concurrent autoplay videos.

---

## 2. WEB — catalog (60 findings)

### 2.0 Web cross-cutting / design system
- **[CC-1] No dark mode anywhere** (P1, L) — no `darkMode` key in `tailwind.config.js`, `index.css` hardcodes `bg-paper text-ink`, `AppLayout.jsx:187` inlines a light gradient; `index.html` even ships a dark favicon + references non-existent dark assets. Add `darkMode:'class'`, tokenize the palette to CSS vars on `:root`/`.dark`, add a persisted toggle, honor `prefers-color-scheme`. Touches every component using `text-ink`/`bg-white/55`/`bg-paper`.
- **[CC-2] Glass cards assume a light wash** (P1, M) — `.card`/`.card-glass` use `bg-white/55 + border-white/60 + backdrop-blur`; invisible/muddy on dark or white bgs. Tokenize surface + border.
- **[CC-3] Icons are copy-pasted inline SVGs, not a system** (P2, M) — 3+ different heart paths across AppLayout/MosaicFeed/MemoryCard/Activity/MemoryDetail/Landing; edit/trash duplicated in Children/MemoryDetail/Milestones. Extract an `icons/` module or adopt `lucide-react`.
- **[CC-4] Dead divergent `MemoryCard.jsx`** (P2, M) — fully built but unused (Dashboard uses MosaicFeed `Tile`); its optimistic-like logic differs. Delete or reconcile to one card pattern.
- **[CC-5] Inconsistent input styling** (P2, S) — shared `.input` used some places; Dashboard search, Upload caption, MosaicFeed composer hand-roll borders with no focus ring. Standardize on `.input`.
- **[CC-6] Focus-visible states largely missing** (P1, M) — nav links, chips, like/comment, rail handles, icon buttons are hover-only. Add a global `:focus-visible` ring.
- **[CC-7] No `prefers-reduced-motion` handling** (P2, S) — hover-translate/scale, spins, pulses, 300ms sidebar transition. Add a global reduce-motion block.
- **[CC-8] Muted-text contrast risk** (P1, S) — `ink-muted #8890a8` (~3.0:1 on white) used for 10–12px meaningful text (UsageMeter, timeline hints, "Showing X of Y"). Darken token or reserve for ≥14px non-essential.
- **[CC-9] Native `window.confirm/alert` for all confirms** (P2, M) — MemoryDetail/Children/Family/Milestones/Settings + error alerts. Build themed `<ConfirmDialog>` + `<Toast>`.
- **[CC-10] Errors surface as `alert()`** (P2, S) — adopt a toast/snackbar for success+error instead of ad-hoc banners.
- **[CC-11] Flat typographic scale** (P2, S) — everything `text-2xl font-bold`; no h1/section rhythm; `font-display`/`font-script` loaded but unused. Establish a semantic scale.
- **[CC-12] `font-script` (Dancing Script) loaded, never rendered** (P2, S) — use it or drop the download.
- **[CC-13] Fonts double-loaded** (P3, S) — `@import` in index.css + `<link>` in index.html; remove the render-blocking `@import`.
- **[CC-14] `sun`/`blue` ramps barely used; `heart` token redundant** (P3, S) — prune or commit to using supporting hues.
- **[CC-15] No global error boundary** (P1, M) — any page render throw white-screens the SPA. Wrap routes with a branded fallback.
- **[CC-16] No 404 surface** (P2, S) — `path="*"` silently `Navigate to="/"`. Add a real not-found page.

### 2.1 Global layout / nav (AppLayout)
- **[LN-1] Mobile web buries nav behind a hamburger** (P1, M) — no bottom tab bar; core destinations hidden. Add a persistent bottom tab bar on mobile web.
- **[LN-2] Collapse bubble desktop-only, tiny target** (P3, S) — enlarge + first-use tooltip.
- **[LN-3] Active nav lacks a rail indicator** (P3, S) — add a colored left border/pill (esp. collapsed).
- **[LN-4] IA: Activity listed before Timeline** though Timeline is home (P2, S) — reorder / add a Home affordance.
- **[LN-5] Plan badge shows raw lowercase** (P3, S) — Title-case it.
- **[LN-6] Avatar `alt=""`, menu button missing aria** (P2, S) — add labels + `aria-haspopup/expanded`.
- **[LN-7] Sidebar can trap scroll on short landscape** (P3, M) — make the whole aside one scroll container so UsageMeter/UserMenu stay reachable.
- **[LN-8] No skip-to-content link** (P2, S).

### 2.2 Dashboard / Timeline (Dashboard, MosaicFeed, DashboardTimeline)
- **[DB-1] Timeline scrubber is `hidden xl:block`** (P1, M) — the signature rail is absent on laptop/tablet/mobile with no alternative. Provide a compact date-jump below xl.
- **[DB-2] Filter bar overflows on mobile** (P2, M) — `ml-auto` type group breaks with many children. Scrollable chip row + separate segmented type control.
- **[DB-3] Three filter mental models** (search vs chips vs rail) (P2, M) — unify into one facet system with "clear all."
- **[DB-4] Skeleton lacks date-header placeholders** (P3, S) — content jumps when data lands.
- **[DB-5] "Load more" button, not infinite scroll** (P2, M) — IO-based auto-load (already used for video).
- **[DB-6] Image pop-in on tiles** (P2, S) — see PF-1.
- **[DB-7] Like/comment tooltips hover-only** (P2, M) — inaccessible on touch/keyboard; add tap/focus popover.
- **[DB-8] Inline comment composer overflows short tiles** (P2, S) — constrain or promote to a centered sheet.
- **[DB-9] Video autoplay ignores reduced-motion/data-saver** (P2, M) — gate behind reduce-motion + connection check.
- **[DB-10] Rail handles tiny + unlabeled** (P2, S) — `role="slider"`, `aria-valuenow`, arrow keys, bigger hit area.
- **[DB-11] Rail `max-h-[calc(100vh-11rem)]` magic number fragile** (P3, S) — derive height via sticky flex.
- **[DB-12] "No family" state competes with onboarding** (P3, S) — verify reachability.

### 2.3 Activity
- **[AC-1] Avatars are initials-only, ignore real photos** (P2, S) — reuse avatar resolution for warmth.
- **[AC-2] Row lacks hover/active/focus affordance** (P3, S).
- **[AC-3] No unread / "new since last visit" treatment** (P3, M).
- **[AC-4] Section headers lack counts** (P3, S).

### 2.4 Upload
- **[UP-1] No client-side size/type rejection** (P2, S) — validate before a full upload attempt.
- **[UP-2] Per-file metadata is a tall un-collapsible stack** (P2, M) — compact rows + expand-on-demand + sticky action bar.
- **[UP-3] Video files show a generic icon, no poster** (P2, M) — capture a first-frame.
- **[UP-4] "Classified" is a bare checkbox** (P2, S) — reuse the Settings toggle switch.
- **[UP-5] Silent 1.5s success redirect** (P2, S) — add a success toast; allow cancel.
- **[UP-6] Dropzone lacks keyboard/focus** (P2, S).
- **[UP-7] iOS advisory always shows** (P3, S) — only when a video is queued.

### 2.5 Memory Detail
- **[MD-1] Loading is a bare spinner (no skeleton)** (P2, S).
- **[MD-2] No lightbox / zoom for the hero image** (P2, M) — notable gap for a photo app.
- **[MD-3] Comment avatar aligned with a `mt-2` hack** (P3, S).
- **[MD-4] Action row crowds three visual weights** (P3, S) — move download/delete/edit to an overflow menu.
- **[MD-5] Edit affordances scattered across 3 modes** (P2, M) — consolidate into one "Edit memory" panel.
- **[MD-6] Location is a raw OSM link** (P3, S) — inline static map thumbnail.
- **[MD-7] Delete-comment is a lowercase text link** (P3, S) — icon + confirm.

### 2.6 Children
- **[CH-1] Add/Edit forms shift the whole list** (P2, M) — modal/slide-over.
- **[CH-2] Avatar upload has no crop/preview/progress** (P2, M).
- **[CH-3] Color swatches: hex `aria-label`, low-contrast check** (P3, S) — name colors, contrast the check.
- **[CH-4] Gender is a binary toggle** (P2, S) — add neutral/prefer-not-to-say (model already tolerates unset).
- **[CH-5] Empty state hides guidance from non-owners** (P3, S).

### 2.7 Family / Members
- **[FM-1] Permission `<select>` pill loses dropdown affordance + varying contrast** (P2, S) — add chevron, fix contrast.
- **[FM-2] Members list has no avatars** (P2, S).
- **[FM-3] Invite stacks three banners** (P3, S) — one result card.
- **[FM-4] Non-owner sees a dead-end card** (P3, S) — show read-only roster + their access level.
- **[FM-5] Per-child permissions promised but not built** (P2, L) — Landing/permission copy claims per-child ACLs; UI only exposes family-wide levels. Product decision: build ACLs (large) or soften copy.

### 2.8 Settings
- **[ST-1] Upgrade buttons are non-functional** (P1, S) — dead primary CTAs on the monetization surface; wire to checkout or remove. (Ties into the RevenueCat billing work.)
- **[ST-2] Usage info duplicated/inconsistent** (P2, S) — surface real used/limit + counts in the plan card.
- **[ST-3] Clerk `<UserProfile>` dropped in raw** (P2, M) — constrain in a card; extend Clerk appearance for dark mode.
- **[ST-4] Location confirm is a 9-line `window.confirm`** (P2, S) — themed dialog.
- **[ST-5] No danger zone (export/delete account)** (P2, M) — privacy policy promises it.

### 2.9 Reels
- **[RE-1] Lightbox lacks keyboard nav + focus trap** (P2, M) — arrows/Escape, focus management.
- **[RE-2] Auto-advance ignores video length + reduced-motion** (P2, S).
- **[RE-3] Locked reel types show 🔒 with no upsell path** (P2, S).
- **[RE-4] Active child filter uses off-palette `bg-gray-900`** (P2, S) — use `ink`.
- **[RE-5] No per-slide progress bar** (P3, S) — story-style progress.

### 2.10 Milestones
- **[MI-1] Upsell wall is plain/off-brand** (P2, S) — richer teaser/preview.
- **[MI-2] Height/weight are free-text w/ free-text units** (P2, S) — numeric + fixed unit selector.
- **[MI-3] No growth chart** (P2, L) — the feature begs for per-metric charts.
- **[MI-4] Row layout unclear for value-less milestones** (P3, S).

### 2.11 Onboarding
- **[ON-1] Default name can be "The undefined Family"** (P2, S) — guard undefined.
- **[ON-2] No back navigation between steps** (P2, S).
- **[ON-3] Step-2 child omits gender/color** (P3, S).
- **[ON-4] Progress dots lack step labels** (P3, S).
- **[ON-5] No guard while `user` loads** (P3, S).

### 2.12 Auth & Marketing (Login, Signup, AcceptInvite, Landing, Contact, Privacy)
- **[AU-1] Auth pages are logo + raw Clerk widget** (P2, M) — two-column brand/benefit + form for conversion.
- **[AU-2] AcceptInvite header stacks awkwardly over Clerk card** (P3, S).
- **[AU-3] "Watch the film" scrolls to a static mockup** (P3, S) — real video/GIF or change copy.
- **[AU-4] `/blog` links assume a separate build** (P3, S) — verify deployed route.
- **[AU-5] Contact/Privacy use raw `text-gray-*`** (P2, S) — convert to ink tokens (won't theme otherwise).
- **[AU-6] Landing cards lift on hover w/o focus equivalent** (P3, S).
- **[AU-7] Landing blur-3xl blobs: perf + no reduce-motion** (P3, S).
- **[AU-8] Emoji as feature iconography** (P2, S) — custom line icons for features; keep emoji for playful empty states.

### 2.13 Web performance
- **[PF-1] Every private image refetched as a blob, no cache** (P1, M) — `AuthedMedia` re-fetches full bytes on every scroll-back; thumbnails not reused into detail. Add a shared blob-URL LRU cache keyed by src.
- **[PF-2] Single 516KB JS bundle, no code-splitting** (P1, M) — route-level `React.lazy`/`Suspense` (MemoryDetail, Reels, DashboardTimeline, all marketing pages authed users never need); split Clerk out of first paint.
- **[PF-3] No `loading="lazy"`/`decoding="async"` on images** (P2, S) — extend IO gating to images.
- **[PF-4] date-fns imported broadly** (P3, S) — verify tree-shaking / no locale bloat.
- **[PF-5] Full-res image used as its own thumbnail fallback** (P2, S) — ensure a sized thumbnail always exists so grids never pull originals.
- **[PF-6] Dashboard overlapping fetches on filter changes** (P3, S) — add AbortController cancellation.

---

## 3. MOBILE — catalog (74 findings)

### 3.1 Timeline (`app/(app)/index.tsx`)
- **[M1] Hardcoded tab-bar clearance** (P2, S) — `paddingBottom:110` magic number vs computed `49+insets.bottom`. Derive a shared `tabBarClearance`.
- **[M2] Scrubber overlaps the right tile column** (P2, M) — absolute rail sits over list padding; tiles render under the rail + thumb steals taps. Reserve a right gutter when the scrubber shows.
- **[M3] No skeleton for filtered loads** (P3, S) — skeleton only when `!filtering`; search/filter shows a blank gap. Skeleton whenever `refreshing && memories.length===0`.
- **[M4] Welcome empty state is bespoke inline markup** (P3, S) — add an `action` slot to `EmptyState` and reuse.
- **[M5] Search field dupes `Input`; no cancel in landscape** (P3, S).
- **[M6] loadMore failures are silent** (P3, S) — footer error row + retry.

### 3.2 Activity (`app/(app)/activity.tsx`)
- **[M7] Rows stretch edge-to-edge on wide screens** (P2, M) — max-width or 2-col ≥700pt.
- **[M8] Actor is initials-only, never a photo** (P3, S).
- **[M9] Icon-only type badge lacks a label** (P2, S) — VoiceOver reads nothing.

### 3.3 Capture (`app/(app)/capture.tsx`)
- **[M10] Per-photo edit sheet: no keyboard avoidance / safe-area** (P1, S) — keyboard covers caption + Done. KAV + `insets.bottom`.
- **[M11] Two raw TextInputs instead of `Input`** (P3, S).
- **[M12] Sticky upload bar breaks the glass language** (P3, M) — solid bar w/ hard border, no `insets.bottom`. Use `GlassView`, safe-area padded.
- **[M13] No cancel during upload / no success haptic** (P3, M).
- **[M14] Center capture-tab ring is a flat color seam** (P3, S) — `borderColor:colors.bg` won't match the gradient behind it.

### 3.4 Reels (`app/(app)/reels.tsx`)
- **[M15] ReelViewer uses hardcoded top offsets, not safe-area** (P1, M) — progress/label/close collide with the notch, esp. **landscape** (side notch); tap zones start at fixed `top:90`. Use `useSafeAreaInsets()`.
- **[M16] Black modal doesn't force a light status bar** (P2, S) — dark status icons invisible over `#000`. `<StatusBar style="light">` inside the modal (also MediaPicker).
- **[M17] Reels header inconsistent with the app** (P2, S) — bare "Reels" title vs branded `SunriseHeader`.
- **[M18] Reel list & cards don't adapt to landscape** (P2, M) — 2-up grid ≥700pt.
- **[M19] Ken Burns + cross-fade ignore Reduce Motion** (P2, S).
- **[M20] Reels discoverability** (P3, S) — off the tab bar (`href:null`); only entry is the Timeline film icon.
- **[M21] No seek/position feedback ("3 of 12")** (P3, M).

### 3.5 Milestones (`app/(app)/milestones.tsx`)
- **[M22] Add sheet: no keyboard avoidance / safe-area** (P1, S) — keyboard covers inputs + button.
- **[M23] Full-screen spinner instead of skeleton** (P2, S).
- **[M24] Milestone icon is always `ribbon`** (P3, S) — map type→icon.
- **[M25] No landscape layout** (P3, S).

### 3.6 Settings (`app/(app)/settings.tsx`)
- **[M26] "Appearance" card looks tappable but is inert** (P2, M) — shows "Automatic — following your device" with no control; users can't force light/dark. Add a Light/Dark/System segmented control.
- **[M27] Storage card causes layout shift** (P3, S) — skeleton card.
- **[M28] Sign-out button mismatched color roles** (P3, S).
- **[M29] No app version / build in footer** (P3, S) — from `expo-constants`.

### 3.7 Memory detail (`app/memory/[id].tsx`)
- **[M30] Media locked to 1:1 `contain`** (P2, M) — tall photos get big letterbox bars. Use real aspect ratio (or cover + tap-to-expand).
- **[M31] Comment bar not safe-area padded at rest** (P2, S) — sits flush to the home indicator.
- **[M32] No pinch-zoom / lightbox** (P2, M) — core photo-app expectation.
- **[M33] Optimistic heart can duplicate** (P3, S) — guard with an in-flight flag.
- **[M34] Action icons have no a11y labels** (P2, S).
- **[M35] Comment timestamps drop the year** (P3, S) — relative time like Activity.

### 3.8 Children & Members (`app/children.tsx`, `app/members.tsx`)
- **[M36] Child form sheet: no keyboard avoidance / safe-area** (P1, S) — Save can be covered.
- **[M37] Members uses a full-screen spinner** (P3, S).
- **[M38] Non-manager state is a bare sentence** (P3, S) — use `EmptyState`.
- **[M39] Permission chips have no explanation** (P3, S) — helper text per selection.
- **[M40] Members has no self-avatar image** (P3, S).

### 3.9 Sign-in (`app/(auth)/sign-in.tsx`)
- **[M41] No ScrollView → landscape/keyboard clipping** (P2, S) — fields/buttons unreachable. Wrap in ScrollView.
- **[M42] Missing forgot-password / sign-up / verification paths** (P2, M).
- **[M43] Hardcoded white logo plate jarring in dark mode** (P3, S) — `#ffffff` → `colors.surface`.
- **[M44] Password: no show/hide, no strong-password autofill** (P3, S) — add `textContentType`.
- **[M45] Google button has no loading state** (P3, S).

### 3.10 Shared components
- **[M46] Bottom sheets have no safe-area or KAV — systemic** (P1, M) — DatePickerField, milestones, children, capture all omit both. Build one `BottomSheet` primitive; adopt everywhere. (Root cause of M10/M22/M36.)
- **[M47] `GlassView`/`Card` blur is expensive + weak on Android** (P2, M) — every Card is a live BlurView; Android is janky/near-opaque. Solid-surface fallback on Android / dense lists.
- **[M48] Multiple mosaic videos autoplay at once** (P2, M) — cap to a single most-centered active video (battery/perf).
- **[M49] `AuthedImage` re-fetches a token per image + blocks render** (P2, M) — returns null until `getToken()`; pop-in. Share token via context; placeholder while pending.
- **[M50] `AuthedImage` sets no `recyclingKey`/`cachePolicy`** (P3, S) — recycled tiles flash the previous image.
- **[M51] DatePicker year range fixed to now-25…now** (P3, S) — widen/parameterize.
- **[M52] DatePicker wheels don't center/snap** (P3, M) — snapping list + haptic.
- **[M53] `EmptyState` has no action slot** (P3, S).
- **[M54] Small tap targets on secondary icon buttons** (P2, S) — ~36px and ~24px (comment delete) below 44pt.

### 3.11 Mobile cross-cutting · theme · dark mode
- **[M55] No manual theme override** (P2, M) — scheme only from `useColorScheme()`. Persisted override. (Pairs with M26.)
- **[M56] `textMuted` identical in both palettes (#8890a8)** (P2, S) — ~3.9:1 on dark surface, under AA. Lift dark `textMuted`.
- **[M57] Four divergent "Sunrise" gradients, none tokenized** (P2, S) — header/tab/splash stops differ. Move gradient sets into theme tokens.
- **[M58] Back-compat `colors`/`shadow` default to light** (P2, S) — direct importers silently break dark. Lint/guard.
- **[M59] Reduce Motion honored nowhere** (P2, M) — pulses, springs, splash, Ken Burns, fades. Central `useReduceMotion()`.
- **[M60] Dynamic Type unsupported / uncapped** (P2, M) — no `allowFontScaling`/`maxFontSizeMultiplier`; large text overflows badges/chips/tab labels.
- **[M61] VoiceOver labels essentially absent** (P1, M) — only 1 `accessibilityLabel` in the whole app; icon-only controls everywhere unlabeled + no roles.
- **[M62] No haptics anywhere** (P3, M) — zero `expo-haptics`. Add tasteful feedback (heart, capture, delete, chips).
- **[M63] Casing handled ad hoc** (P3, S) — mixed `textTransform` + pre-uppercased strings. One `overline`/`eyebrow` variant.
- **[M64] `DancingScript` loaded but unused** (P3, S) — only in logo PNGs; use as a warmth accent (family name).
- **[M65] Alert-only error surface** (P3, M) — `Alert.alert`/inline red; add a toast/snackbar system.

**Positives to preserve:** the `wide` mosaic packing, two-pane detail, responsive Capture/Picker columns, the theme-aware shadow split (warm light vs black+elevation dark), the glass tab bar, the segmented reel player, and the "already added" upload de-dupe are strong foundations — the pattern to extend, not replace.

---

## 4. Top 10 highest-impact items (quick triage)

If we only did ten things, these move the needle most (beauty + function + coherence):

1. **Web dark mode** — `CC-1` + `CC-2` + `SYS-1` (tokenize). Biggest cross-platform inconsistency.
2. **Shared token source across web + mobile** — `SYS-1/2` + `M57` gradients. Unblocks everything and stops drift.
3. **Mobile bottom-sheet primitive (KAV + safe-area)** — `M46` (fixes `M10/M22/M36`; keyboard covers inputs on Capture/Milestones/Children today — a real functional bug).
4. **Accessibility base pass** — `M61` (VoiceOver labels) + `CC-6` (web focus rings) + `A11Y-*`. Currently near-zero.
5. **Web image/blob cache + code-splitting** — `PF-1` + `PF-2`. First-paint + scroll perf.
6. **Themed dialogs + toasts** (kill `window.confirm`/`Alert.alert`) — `CC-9/10` + `M65`.
7. **Mobile timeline scrubber overlap + tab-bar clearance** — `M2` + `M1`.
8. **Reels safe-area + landscape + light status bar** — `M15/M16/M18`.
9. **Photo lightbox / real aspect ratio in detail** — `MD-2` + `M30/M32`.
10. **Dark-mode toggle + contrast fixes on mobile** — `M26/M55` + `M56` (+ web `CC-8`).

---

## 5. DARK MODE — coverage matrix

### Web — **not implemented at all** (headline). Plan:
1. `SYS-1` tokenize palette to CSS vars on `:root`/`.dark`.
2. Add `darkMode:'class'` to `tailwind.config.js`; toggle sets `.dark` on `<html>`; default from `prefers-color-scheme`; persist (like `NAV_COLLAPSED_KEY`).
3. Author dark values for every semantic token; sweep every page for `bg-white*`, `text-ink*`, `bg-paper`, `text-gray-*` (`AU-5`), the fixed light gradient (`AppLayout.jsx:187`), `.card`/`.card-glass` glass (`CC-2`), shadows.
4. Extend the Clerk `appearance` (main.jsx) for dark (`ST-3`).
5. Add the toggle to `UserMenu`/Settings.
6. Remove the stale dark-favicon/asset references or wire them up.

### Mobile — system-driven, tokens strong, gaps:
- `M26` inert "Appearance" card / `M55` no override → add Light/Dark/System control.
- `M56` dark `textMuted` fails AA.
- `M57` gradients not tokenized; `M58` back-compat light defaults; `M43` white sign-in plate; per-component hardcoded colors from the 44-occurrence sweep (§1.2 DM-3) — audit each (scrims over media stay white; structural surfaces move to tokens).
- Verify: status bar per screen (`M16`), tab-bar glass in dark (`M47` Android), splash dark variant (already added).

---

## 6. LANDSCAPE — coverage matrix

**Mobile — currently landscape-aware ✅:** Timeline mosaic (denser templates), Memory Detail (two-pane), Capture grid (6 col), MediaPicker grid (7 col), AnimatedSplash aspect (though `M72`: size against `min(width,height)`).

**Mobile — NOT yet landscape-aware (catalog targets):**
- **Reels player + list** — `M15` (safe-area/side-notch offsets) + `M18` (2-up list) + `M16` (light status bar). The story/slideshow assumes portrait; needs letterbox media, side-positioned progress/controls. (P1/P2, M)
- **Floating glass tab bar** — `M66` — no landscape height/inset handling; wide-short bar + raised-button geometry look sparse; side safe-area insets unhandled. Consider a side rail on wide screens. (P2, M)
- **Headers / safe-area** — `M71` (SunriseHeader top-only insets) + `M74` (MediaPicker header) + `M31` (comment bar) — apply `insets.left/right` and `insets.bottom` so nothing sits under a side notch / home indicator. (P2, S)
- **Activity** — `M7` — full-width single-column rows; max-width or 2-col ≥700pt. (P2, M)
- **Milestones / Settings / Children / Members** — `M25/M69` — single-column, no `>700` branch; wide cards. Two-column or centered max-width container. (P3, M)
- **Sign-in** — `M41` — clips in landscape (no ScrollView). (P2, S)
- **Capture sticky bar + KAV in landscape** — `M73` — keyboard-up can cover the grid; batch caption hard to reach. (P3, S)
- **[LS-8] Orientation-lock option** (P3, S) — optional Settings toggle, or lock Reels to a chosen orientation.

**Web:** responsive down/up already, but **[LS-W1]** ultra-wide (`xl:`/`2xl:`) is barely used (1 hit) — timeline + detail could use a true multi-column masonry and a persistent detail pane on large desktops; the timeline scrubber is `hidden xl:block` (`DB-1`) so tablet/mobile lose it. Audit each page for wasted width and short-landscape mobile-web layout.

---

## 7. Suggested sequencing (to be finalized with you)

1. **Foundations:** SYS-1/2 tokens → unblock DM-0 (web dark mode) and consistency.
2. **Dark mode:** web full pass + mobile toggle + contrast fixes (DM-1/2/3).
3. **Landscape:** finish the mobile matrix (LS-1…7), starting with Reels + tab bar + headers.
4. **State & motion polish:** per-screen empty/loading/error + motion tokens + reduce-motion.
5. **A11y + performance sweeps.**
6. **Screen-by-screen beautification** per §2/§3.

_This sequencing and the full per-screen lists get finalized once the per-screen passes are merged in._
