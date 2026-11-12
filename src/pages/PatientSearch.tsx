// Public patient search page – shown at the root route (/)
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Hospital {
  id: string
  name: string
}

interface Resource {
  id: string
  hospital_id: string
  category: string
  available: number
  total: number
  updated_at: string // ISO timestamptz
}

interface HospitalWithResources extends Hospital {
  resources: Resource[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Returns how many minutes ago an ISO timestamp was. */
function minutesAgo(isoString: string): number {
  return Math.floor((Date.now() - new Date(isoString).getTime()) / 60_000)
}

/** Returns true if the timestamp is older than 2 hours. */
function isStale(isoString: string): boolean {
  return minutesAgo(isoString) > 120
}

/** Colour token for a resource row (ignored when stale). */
function availabilityColour(available: number, total: number): 'green' | 'amber' | 'red' {
  if (available === 0) return 'red'
  if (total > 0 && available / total > 0.2) return 'green'
  return 'amber'
}

/** Formats "X min ago" or "Xh Ym ago" for readability. */
function relativeTime(isoString: string): string {
  const mins = minutesAgo(isoString)
  if (mins < 60) return `${mins} min ago`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h ago` : `${h}h ${m}m ago`
}

// ── Colour-coded badge classes ─────────────────────────────────────────────────

const colourClasses = {
  green: {
    dot: 'bg-green-400',
    badge: 'text-green-300 bg-green-950/50 border-green-800',
  },
  amber: {
    dot: 'bg-amber-400',
    badge: 'text-amber-300 bg-amber-950/50 border-amber-800',
  },
  red: {
    dot: 'bg-red-400',
    badge: 'text-red-300 bg-red-950/50 border-red-800',
  },
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ResourceRow({ res }: { res: Resource }) {
  const stale = isStale(res.updated_at)
  const colour = availabilityColour(res.available, res.total)
  const { dot, badge } = colourClasses[colour]

  return (
    <div
      className={`flex items-center justify-between py-2 px-3 rounded-md text-sm ${
        stale ? 'opacity-50' : ''
      }`}
    >
      {/* Category + availability */}
      <div className="flex items-center gap-2">
        {stale ? (
          <span className="inline-block w-2 h-2 rounded-full bg-slate-500 shrink-0" />
        ) : (
          <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${dot}`} />
        )}
        <span className={stale ? 'text-slate-500' : 'text-slate-200'}>{res.category}</span>
      </div>

      {/* Right side: count + updated label */}
      <div className="flex flex-col items-end gap-0.5">
        {stale ? (
          <>
            <span className="text-slate-500 font-mono text-xs">
              {res.available} / {res.total}
            </span>
            <span className="text-xs text-slate-500 italic">Unverified – call hospital to confirm</span>
          </>
        ) : (
          <>
            <span className={`font-mono text-xs px-2 py-0.5 rounded border ${badge}`}>
              {res.available} / {res.total}
            </span>
            <span className="text-[11px] text-slate-500">Updated {relativeTime(res.updated_at)}</span>
          </>
        )}
      </div>
    </div>
  )
}

function HospitalCard({ hospital }: { hospital: HospitalWithResources }) {
  return (
    <li className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60">
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-800/40">
        <h2 className="text-base font-semibold text-cyan-300">{hospital.name}</h2>
      </div>
      {hospital.resources.length === 0 ? (
        <p className="px-4 py-3 text-slate-600 text-xs italic">No resource data available.</p>
      ) : (
        <ul className="divide-y divide-slate-800/60 px-2 py-1">
          {hospital.resources.map((res) => (
            <li key={res.id}>
              <ResourceRow res={res} />
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PatientSearch() {
  const [hospitals, setHospitals] = useState<HospitalWithResources[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(!navigator.onLine)

  // Keep a stable ref to hospitals so the realtime handler always sees fresh data
  const hospitalsRef = useRef<HospitalWithResources[]>([])

  // ── Data fetching ────────────────────────────────────────────────────────────

  async function fetchAll(isRetry = false) {
    if (isRetry) setError(null)

    const [{ data: hData, error: hErr }, { data: rData, error: rErr }] = await Promise.all([
      supabase.from('hospitals').select('id, name').order('name'),
      supabase.from('resources').select('id, hospital_id, category, available, total, updated_at'),
    ])

    if (hErr || rErr) {
      setError((hErr ?? rErr)!.message)
      setLoading(false)
      return
    }

    const hosps: HospitalWithResources[] = (hData ?? []).map((h) => ({
      ...h,
      resources: (rData ?? []).filter((r) => r.hospital_id === h.id),
    }))

    hospitalsRef.current = hosps
    setHospitals(hosps)
    setError(null)
    setLoading(false)
  }

  // ── Realtime: patch a single resource row in state ──────────────────────────

  function applyResourceChange(payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE'
    new: Partial<Resource>
    old: Partial<Resource>
  }) {
    setHospitals((prev) => {
      const updated = prev.map((h) => {
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

      hospitalsRef.current = updated
      return updated
    })
  }

  // ── Effects ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchAll()

    // Supabase Realtime subscription on the resources table
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

    // Re-fetch when the browser comes back online
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

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center gap-6 p-6">
      {/* Offline / fetch-failure banner */}
      {(offline || error) && (
        <div
          role="alert"
          className="w-full max-w-xl flex items-center gap-2 bg-red-950 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3"
        >
          <span className="text-base">⚠️</span>
          {offline
            ? 'Offline – data may be outdated'
            : `Error loading data – data may be outdated: ${error}`}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-4xl font-bold tracking-tight text-cyan-400">CareRoute</h1>
        <p className="text-slate-400 text-lg text-center max-w-md">
          Real-time hospital bed &amp; emergency resource availability for{' '}
          <span className="text-white font-semibold">Tumakuru</span>.
        </p>
      </div>

      {/* Loading state */}
      {loading && (
        <p className="text-slate-500 text-sm animate-pulse">Loading hospitals…</p>
      )}

      {/* Empty state (no error, not loading) */}
      {!loading && !error && hospitals.length === 0 && (
        <p className="text-slate-600 text-sm italic">No hospitals found.</p>
      )}

      {/* Hospital cards */}
      {!loading && hospitals.length > 0 && (
        <ul className="w-full max-w-xl flex flex-col gap-4">
          {hospitals.map((h) => (
            <HospitalCard key={h.id} hospital={h} />
          ))}
        </ul>
      )}

      {/* Legend */}
      {!loading && hospitals.length > 0 && (
        <div className="flex gap-4 text-xs text-slate-500 flex-wrap justify-center">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> &gt;20% available
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> 1–20% available
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> None available
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-500 inline-block" /> Data unverified (&gt;2 h old)
          </span>
        </div>
      )}
    </main>
  )
}
