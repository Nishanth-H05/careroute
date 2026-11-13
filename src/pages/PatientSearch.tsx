// Public patient search page â€“ shown at the root route (/)
// Design: light theme, mobile-first, one accent colour (cyan-700), system font, WCAG AA.
import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type ResourceSource = 'demo' | 'hospital' | 'phone'

interface Hospital {
  id: string
  name: string
  verified: boolean
  phone: string | null
  latitude: number | null
  longitude: number | null
}

interface Resource {
  id: string
  hospital_id: string
  category: string
  available: number | null
  total: number | null
  updated_at: string // ISO timestamptz
  source: ResourceSource | null
}

interface HospitalWithResources extends Hospital {
  resources: Resource[]
  distanceKm: number | null
}

type FilterChip = 'All' | 'General' | 'Semi-special' | 'Special' | 'ICU'

const FILTER_CHIPS: FilterChip[] = ['All', 'General', 'Semi-special', 'Special', 'ICU']

// Tumakuru city centre fallback coordinates
const TUMAKURU_LAT = 13.3379
const TUMAKURU_LNG = 77.1173

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function minutesAgo(isoString: string): number {
  return Math.floor((Date.now() - new Date(isoString).getTime()) / 60_000)
}

function isStale(isoString: string): boolean {
  return minutesAgo(isoString) > 120
}

function relativeTime(isoString: string): string {
  const mins = minutesAgo(isoString)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h ago` : `${h}h ${m}m ago`
}

/** Haversine distance in km between two lat/lng pairs. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m away`
  return `${km.toFixed(1)} km away`
}

/** Assign distances and sort nearest-first. */
function attachDistances(
  hospitals: Omit<HospitalWithResources, 'distanceKm'>[],
  userLat: number,
  userLng: number,
): HospitalWithResources[] {
  return hospitals
    .map((h) => ({
      ...h,
      distanceKm:
        h.latitude != null && h.longitude != null
          ? haversineKm(userLat, userLng, h.latitude, h.longitude)
          : null,
    }))
    .sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) return 0
      if (a.distanceKm == null) return 1
      if (b.distanceKm == null) return -1
      return a.distanceKm - b.distanceKm
    })
}

// â”€â”€ Source label config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const SOURCE_CONFIG: Record<
  ResourceSource,
  { label: string; className: string }
> = {
  demo: {
    label: 'Demo data',
    className: 'text-slate-500 bg-slate-100 border-slate-300',
  },
  hospital: {
    label: 'Reported by hospital',
    className: 'text-cyan-800 bg-cyan-50 border-cyan-300',
  },
  phone: {
    label: 'Confirmed by phone',
    className: 'text-emerald-800 bg-emerald-50 border-emerald-300',
  },
}

// â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ResourceRow({ res }: { res: Resource }) {
  const stale = isStale(res.updated_at)
  const available = res.available ?? null
  const total = res.total ?? null
  const sourceKey = (res.source ?? 'demo') as ResourceSource
  const src = SOURCE_CONFIG[sourceKey] ?? SOURCE_CONFIG.demo

  const countText =
    available != null && total != null
      ? `${available} available of ${total}`
      : 'Not reported'

  return (
    <div
      className={`flex flex-col gap-1 py-3 px-3 rounded-md border ${
        stale ? 'opacity-60 border-slate-200 bg-slate-50' : 'border-transparent bg-white'
      }`}
      aria-label={`${res.category}: ${countText}`}
    >
      {/* Top row: category + source label */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-slate-800 text-base">{res.category}</span>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded border ${src.className}`}
          aria-label={`Data source: ${src.label}`}
        >
          {src.label}
        </span>
      </div>

      {/* Count line */}
      <p className={`text-sm font-semibold ${stale ? 'text-slate-400' : 'text-slate-700'}`}>
        {countText}
        {available != null && total != null && !stale && (
          <span className="font-normal text-slate-500"> â€“ Reported available â€“ call to confirm</span>
        )}
      </p>

      {/* Updated / stale line */}
      {stale ? (
        <p className="text-xs text-slate-500 italic">
          âš  Unverified â€“ call hospital to confirm (updated {relativeTime(res.updated_at)})
        </p>
      ) : (
        <p className="text-xs text-slate-400">Updated {relativeTime(res.updated_at)}</p>
      )}
    </div>
  )
}

function HospitalCard({ hospital }: { hospital: HospitalWithResources }) {
  const hasAnyResource = hospital.resources.length > 0

  return (
    <li className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
      {/* Card header */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-bold text-slate-900 leading-tight">{hospital.name}</h2>
          {hospital.distanceKm != null && (
            <p className="text-sm text-slate-500">{formatDistance(hospital.distanceKm)}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
          {hospital.verified && (
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-full px-2 py-0.5"
              title="This hospital has been verified"
              aria-label="Verified hospital"
            >
              âœ“ Verified
            </span>
          )}
          {hospital.phone && (
            <a
              href={`tel:${hospital.phone}`}
              aria-label={`Call ${hospital.name} at ${hospital.phone}`}
              className="inline-flex items-center gap-1.5 min-h-12 px-4 text-sm font-semibold text-white bg-cyan-700 hover:bg-cyan-800 rounded-xl focus-visible:outline-2 focus-visible:outline-cyan-700 focus-visible:outline-offset-2 transition-colors"
            >
              ðŸ“ž Call hospital
            </a>
          )}
        </div>
      </div>

      {/* Bed rows */}
      <div className="px-3 py-2">
        {!hasAnyResource ? (
          <p className="text-sm text-slate-400 italic py-2">No bed data reported.</p>
        ) : (
          <ul className="flex flex-col gap-1" aria-label={`Bed categories for ${hospital.name}`}>
            {hospital.resources.map((res) => (
              <li key={res.id}>
                <ResourceRow res={res} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  )
}

// â”€â”€ Main page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function PatientSearch() {
  // Raw data from Supabase (no distance attached yet)

  // Displayed list (with distances, sorted, filtered)
  const [hospitals, setHospitals] = useState<HospitalWithResources[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(!navigator.onLine)
  const [activeFilter, setActiveFilter] = useState<FilterChip>('All')
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [locationLabel, setLocationLabel] = useState<string>('') // what location was used
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  // Stable ref so realtime handler always sees current raw data
  const rawRef = useRef<Omit<HospitalWithResources, 'distanceKm'>[]>([])
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null)

  // â”€â”€ Derived: does any visible row have source = "demo"? â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const hasDemoData = hospitals.some((h) =>
    h.resources.some((r) => (r.source ?? 'demo') === 'demo'),
  )

  // â”€â”€ Recompute displayed list whenever raw data, coords, or filter change â”€â”€â”€â”€

  const recompute = useCallback(
    (
      raw: Omit<HospitalWithResources, 'distanceKm'>[],
      coords: { lat: number; lng: number } | null,
      filter: FilterChip,
    ) => {
      const lat = coords?.lat ?? TUMAKURU_LAT
      const lng = coords?.lng ?? TUMAKURU_LNG
      const withDist = attachDistances(raw, lat, lng)

      const filtered =
        filter === 'All'
          ? withDist
          : withDist
              .map((h) => ({
                ...h,
                resources: h.resources.filter(
                  (r) => r.category.toLowerCase() === filter.toLowerCase(),
                ),
              }))
              .filter((h) => h.resources.length > 0)

      setHospitals(filtered)
    },
    [],
  )

  // â”€â”€ Data fetching â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async function fetchAll(isRetry = false) {
    if (isRetry) setError(null)

    const [{ data: hData, error: hErr }, { data: rData, error: rErr }] = await Promise.all([
      supabase
        .from('hospitals')
        .select('id, name, verified, phone, latitude, longitude')
        .order('name'),
      supabase
        .from('resources')
        .select('id, hospital_id, category, available, total, updated_at, source'),
    ])

    if (hErr || rErr) {
      setError((hErr ?? rErr)!.message)
      setLoading(false)
      return
    }

    const hosps: Omit<HospitalWithResources, 'distanceKm'>[] = (hData ?? []).map((h) => ({
      ...h,
      verified: h.verified ?? false,
      phone: h.phone ?? null,
      latitude: h.latitude ?? null,
      longitude: h.longitude ?? null,
      resources: (rData ?? []).filter((r) => r.hospital_id === h.id),
    }))

    rawRef.current = hosps
    setError(null)
    setLoading(false)
    recompute(hosps, coordsRef.current, activeFilter)
  }

  // â”€â”€ Realtime: patch a single resource row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  function applyResourceChange(payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE'
    new: Partial<Resource>
    old: Partial<Resource>
  }) {
    const updated = rawRef.current.map((h) => {
      let resources = [...h.resources]

      if (payload.eventType === 'DELETE') {
        resources = resources.filter((r) => r.id !== payload.old.id)
      } else if (payload.eventType === 'INSERT') {
        if (payload.new.hospital_id === h.id) {
          resources = [...resources, payload.new as Resource]
        }
      } else if (payload.eventType === 'UPDATE') {
        resources = resources.map((r) =>
          r.id === payload.new.id ? { ...r, ...(payload.new as Resource) } : r,
        )
      }

      return { ...h, resources }
    })

    rawRef.current = updated
    recompute(updated, coordsRef.current, activeFilter)
  }

  // Geolocation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  function requestLocation() {
    if (!navigator.geolocation) {
      setGeoError('Geolocation not supported by this browser.')
      useFallback()
      return
    }
    setGeoLoading(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Patient coords are NEVER sent to Supabase â€“ used only for local distance calc
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        coordsRef.current = coords
        setUserCoords(coords)
        setLocationLabel('Near you')
        setGeoLoading(false)
        recompute(rawRef.current, coords, activeFilter)
      },
      () => {
        setGeoError('Location access denied â€“ showing nearest to Tumakuru city centre instead.')
        useFallback()
      },
      { timeout: 8000 },
    )
  }

  function useFallback() {
    const coords = { lat: TUMAKURU_LAT, lng: TUMAKURU_LNG }
    coordsRef.current = coords
    setUserCoords(coords)
    setLocationLabel('Tumakuru city centre (fallback)')
    setGeoLoading(false)
    recompute(rawRef.current, coords, activeFilter)
  }

  // â”€â”€ Effects â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  useEffect(() => {
    fetchAll()

    const channel = supabase
      .channel('resources-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'resources' },
        (payload) => {
          applyResourceChange(payload as Parameters<typeof applyResourceChange>[0])
        },
      )
      .subscribe()

    function handleOnline() {
      setOffline(false)
      fetchAll(true)
    }
    function handleOffline() {
      setOffline(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-filter when activeFilter changes
  useEffect(() => {
    recompute(rawRef.current, coordsRef.current, activeFilter)
  }, [activeFilter, recompute])

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* â”€â”€ Skip link (accessibility) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <a
        href="#results"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-cyan-700 focus:text-white focus:rounded-lg"
      >
        Skip to results
      </a>

      {/* â”€â”€ Offline / error banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {(offline || error) && (
        <div
          role="alert"
          aria-live="assertive"
          className="bg-red-50 border-b border-red-300 text-red-800 text-sm px-4 py-3 flex items-center gap-2"
        >
          <span aria-hidden="true">âš </span>
          <span>
            {offline
              ? 'You are offline â€“ data may be outdated. Reconnect to see live availability.'
              : `Could not load data: ${error}`}
          </span>
        </div>
      )}

      {/* â”€â”€ Demo data banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {hasDemoData && (
        <div
          role="status"
          aria-live="polite"
          className="bg-amber-50 border-b border-amber-300 text-amber-800 text-sm px-4 py-3 flex items-center gap-2"
        >
          <span aria-hidden="true">â„¹</span>
          <span>Demo data â€“ not real availability. Contact the hospital to confirm.</span>
        </div>
      )}

      {/* â”€â”€ Geolocation error notice â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {geoError && (
        <div
          role="status"
          aria-live="polite"
          className="bg-blue-50 border-b border-blue-200 text-blue-800 text-sm px-4 py-3"
        >
          {geoError}
        </div>
      )}

      <main className="max-w-xl mx-auto px-4 pb-16">
        {/* â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <header className="pt-6 pb-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 leading-tight">
              CareRoute Tumakuru
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Real-time hospital bed availability
            </p>
          </div>
          <a
            href="tel:112"
            aria-label="Emergency: Call 112"
            className="flex-shrink-0 inline-flex items-center gap-1.5 min-h-12 px-4 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl focus-visible:outline-2 focus-visible:outline-red-700 focus-visible:outline-offset-2 transition-colors"
          >
            ðŸš¨ Emergency? Call 112
          </a>
        </header>

        {/* â”€â”€ Location section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <section aria-label="Find hospitals near you" className="mb-5">
          <button
            onClick={requestLocation}
            disabled={geoLoading}
            aria-label="Find hospitals near my current location"
            className="w-full min-h-14 text-base font-bold text-white bg-cyan-700 hover:bg-cyan-800 disabled:opacity-60 rounded-2xl focus-visible:outline-2 focus-visible:outline-cyan-700 focus-visible:outline-offset-2 transition-colors flex items-center justify-center gap-2"
          >
            {geoLoading ? 'Detecting locationâ€¦' : 'ðŸ“ Find hospitals near me'}
          </button>

          {/* Fallback button */}
          {!userCoords && !geoLoading && (
            <button
              onClick={useFallback}
              aria-label="Use Tumakuru city centre as your location"
              className="mt-2 w-full min-h-12 text-sm font-medium text-cyan-700 bg-white border border-cyan-200 hover:bg-cyan-50 rounded-xl focus-visible:outline-2 focus-visible:outline-cyan-700 focus-visible:outline-offset-2 transition-colors"
            >
              Use Tumakuru city centre instead
            </button>
          )}

          {/* Active location label */}
          {locationLabel && (
            <p className="mt-2 text-xs text-center text-slate-400" aria-live="polite">
              Showing distance from: <span className="font-medium text-slate-600">{locationLabel}</span>
            </p>
          )}
        </section>

        {/* â”€â”€ Filter chips â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <section aria-label="Filter by bed category" className="mb-5">
          <div
            role="group"
            aria-label="Bed category filters"
            className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
          >
            {FILTER_CHIPS.map((chip) => {
              const isActive = chip === activeFilter
              return (
                <button
                  key={chip}
                  onClick={() => setActiveFilter(chip)}
                  aria-pressed={isActive}
                  aria-label={`Filter: ${chip}`}
                  className={`flex-shrink-0 min-h-10 px-4 text-sm font-semibold rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-cyan-700 focus-visible:outline-offset-2 ${
                    isActive
                      ? 'bg-cyan-700 text-white border-cyan-700'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {chip}
                </button>
              )
            })}
          </div>
        </section>

        {/* â”€â”€ Results â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <section id="results" aria-label="Hospital list" aria-live="polite">
          {/* Loading */}
          {loading && (
            <p className="text-slate-500 text-sm py-6 text-center">
              Loading hospitalsâ€¦
            </p>
          )}

          {/* Empty state */}
          {!loading && !error && hospitals.length === 0 && (
            <p className="text-slate-400 text-sm py-6 text-center italic">
              {activeFilter === 'All'
                ? 'No hospitals found.'
                : `No hospitals with "${activeFilter}" beds in the data.`}
            </p>
          )}

          {/* Hospital cards */}
          {!loading && hospitals.length > 0 && (
            <ul className="flex flex-col gap-4" aria-label="Hospitals near you">
              {hospitals.map((h) => (
                <HospitalCard key={h.id} hospital={h} />
              ))}
            </ul>
          )}
        </section>

        {/* â”€â”€ Legend â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {!loading && hospitals.length > 0 && (
          <footer className="mt-8 pt-4 border-t border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Data sources
            </p>
            <ul className="flex flex-col gap-1 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-slate-300 flex-shrink-0" aria-hidden="true" />
                Grey badge = Demo data (not real availability)
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0" aria-hidden="true" />
                Blue badge = Reported by hospital staff
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" aria-hidden="true" />
                Green badge = Confirmed by phone call
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-300 flex-shrink-0" aria-hidden="true" />
                Greyed-out row = Data over 2 hours old â€“ call to confirm
              </li>
            </ul>
            <p className="mt-3 text-xs text-slate-400">
              Availability is reported by hospitals and may change. Always call ahead to confirm a bed.
            </p>
          </footer>
        )}
      </main>
    </div>
  )
}



