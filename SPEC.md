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
