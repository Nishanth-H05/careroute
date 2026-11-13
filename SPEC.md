# CareRoute – Project Specification

> Real-time hospital bed and emergency resource availability platform for Tumakuru.

## Scope

- **Patient side** (`/`): public search, no login required.
- **Staff portal** (`/staff`): hospital staff only, login required (Supabase Auth).
- Information-only. No calling, no ads, no paid APIs.

---

## Rules — ALWAYS FOLLOW

1. **Free tier only.**  
   Do not add any paid service or library that requires a billing card.  
   Forbidden: Google Maps, Twilio, Mapbox paid tier, etc.  
   Allowed: OpenStreetMap + Leaflet (free), Supabase free tier.

2. **Never store patient location on the server.**  
   Patient geolocation is computed in the browser and used only for local distance calculations. It is never sent to Supabase or any external service.

3. **Secrets go in `.env` only.**  
   - `.env` is listed in `.gitignore` and is never committed.  
   - `.env.example` (no real values) IS committed.  
   - Environment variables are prefixed with `VITE_` so Vite exposes them to the browser.

4. **Staff accounts are created by an admin, never by self-signup.**  
   The patient-facing UI has no registration form.  
   The Supabase project must have "Disable signup" enabled in Auth settings.

5. **Bed data must never be cached offline by the PWA.**  
   The service worker must use **network-first** (falling back to a stale cached response only for the shell) for any Supabase API calls.  
   Do NOT cache `/rest/v1/` or realtime responses offline.

6. **Every bed record shows an "updated X minutes ago" label.**  
   Store `updated_at` (timestamptz) on every bed record row.  
   The UI computes elapsed time client-side using `Date.now()`.

7. **Make small changes only, and explain each file you create in one line.**  
   Each PR / commit should touch as few files as possible.  
   Every new file must have a one-line comment at the top describing its purpose.

---

## Design rules

> Applied to the patient-facing `/` page only. Staff pages keep their existing dark theme.

1. **Light theme, high contrast.** Background `#ffffff` / `#f8fafc`, text `#0f172a`. No dark backgrounds on the patient page.
2. **One accent colour.** Calm blue-teal: `#0e7490` (Tailwind `cyan-700`) for primary actions and links. Active/hover darkens to `#155e75` (`cyan-800`). Do not add a second accent colour.
3. **System font stack.** `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`. No decorative web fonts on the patient page. Inter (loaded for staff pages) is acceptable if already in cache.
4. **No decorative graphics or animations.** No hero images, no animated loaders, no transitions beyond a plain focus outline. Loading state is plain text only.
5. **Mobile first.** All layout decisions start at 320 px. Use `sm:` breakpoints for wider screens. Body text minimum `1rem` (16 px). All interactive targets minimum `48px` tall (`min-h-12`).
6. **10-second goal.** The "Find hospitals near me" button must be the first interactive element after the header so a patient can trigger location search immediately on page load.
7. **Heading order.** `<h1>` = page title, `<h2>` = hospital name, `<h3>` = section sub-headings if needed. Never skip a level.
8. **Visible focus outlines.** Every focusable element must have `focus-visible:outline-2 focus-visible:outline-cyan-700 focus-visible:outline-offset-2`. Never suppress the outline entirely.
9. **WCAG AA colour contrast.** All text on its background must meet 4.5:1 for normal text, 3:1 for large text. Never use colour as the only signal — always pair with text or an icon.
10. **Source labels.** Every bed row shows a source label from `resources.source`: `"demo"` → grey "Demo data", `"hospital"` → blue "Reported by hospital", `"phone"` → green "Confirmed by phone". If any visible row has `source = "demo"`, show a site-wide banner: "Demo data – not real availability."
11. **Trust copy.** Use "Reported available – call to confirm". Never use "guaranteed" or "reserved".
12. **Stale handling.** Data older than 2 hours is greyed out with both reduced opacity AND the text label "Unverified – call hospital to confirm". Colour change alone is never the only signal.

---

## Stack

| Layer | Choice |
|---|---|
| Front-end framework | React 19 + TypeScript |
| Build tool | Vite 8 |
| Styling | Tailwind CSS v4 |
| Routing | React Router v7 |
| Backend / Auth | Supabase (free tier) |
| Map | Leaflet + react-leaflet + OpenStreetMap |
| PWA | vite-plugin-pwa |

---

## Folder structure (target)

```
src/
  pages/
    PatientSearch.tsx   # public homepage
    StaffLogin.tsx      # staff login page
    StaffDashboard.tsx  # (future) protected staff view
  components/           # shared UI components
  lib/
    supabase.ts         # Supabase client singleton
  hooks/                # custom React hooks
  types/                # shared TypeScript types
  App.tsx               # router root
  main.tsx              # entry point
```
