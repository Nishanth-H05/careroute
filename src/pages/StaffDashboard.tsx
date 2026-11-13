// Staff dashboard – protected page; shows resource rows for the staff member's hospital with +/- controls
import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import RequireAuth from '../components/RequireAuth'

interface Resource {
  id: string
  hospital_id: string
  category: string
  available: number | null
  total: number
  updated_at: string
}

/** Returns "X min ago" / "X hr ago" label from an ISO timestamp */
function timeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  return `${hrs} hr ago`
}

/** Returns true when updated_at is older than 2 hours */
function isStale(isoString: string): boolean {
  return Date.now() - new Date(isoString).getTime() > 2 * 60 * 60 * 1000
}

/** Finds the oldest updated_at among all non-null resources */
function oldestUpdatedAt(resources: Resource[]): string | null {
  const reported = resources.filter(r => r.available !== null)
  if (reported.length === 0) return null
  return reported.reduce((oldest, r) =>
    new Date(r.updated_at) < new Date(oldest) ? r.updated_at : oldest,
    reported[0].updated_at
  )
}

// ─── Single bed-category row ────────────────────────────────────────────────

interface RowProps {
  resource: Resource
  isSaving: boolean
  error: string | undefined
  onAdjust: (resource: Resource, delta: number) => void
  onSaveCount: (resource: Resource, count: number) => void
}

function BedRow({ resource, isSaving, error, onAdjust, onSaveCount }: RowProps) {
  const [draftCount, setDraftCount] = useState<string>('')
  const isUnreported = resource.available === null
  const stale = !isUnreported && isStale(resource.updated_at)

  // Reset draft when resource switches from unreported → reported
  const prevUnreported = useRef(isUnreported)
  useEffect(() => {
    if (prevUnreported.current && !isUnreported) {
      setDraftCount('')
    }
    prevUnreported.current = isUnreported
  }, [isUnreported])

  function handleSaveDraft() {
    const n = parseInt(draftCount, 10)
    if (isNaN(n) || n < 0 || n > resource.total) return
    onSaveCount(resource, n)
  }

  const draftNum = parseInt(draftCount, 10)
  const draftValid = !isNaN(draftNum) && draftNum >= 0 && draftNum <= resource.total

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
      {/* Row header: category name + stale badge */}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-white font-semibold text-lg sm:text-xl capitalize flex-1">
          {resource.category}
        </h2>
        {stale && (
          <span className="text-xs font-bold bg-red-600 text-white rounded-full px-3 py-1 leading-tight">
            Stale – please update
          </span>
        )}
      </div>

      {/* Count display */}
      {isUnreported ? (
        <p className="text-slate-400 text-sm italic">Not reported yet</p>
      ) : (
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-4xl font-bold text-cyan-300 tabular-nums leading-none">
            {resource.available}
            <span className="text-slate-400 text-xl font-normal"> / {resource.total}</span>
          </span>
          <span className="text-slate-500 text-xs">
            Updated {timeAgo(resource.updated_at)}
          </span>
        </div>
      )}

      {/* Per-row error */}
      {error && (
        <p role="alert" className="text-red-300 text-sm font-medium bg-red-950/60 border border-red-700 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      {/* Unreported: show number input + Save button */}
      {isUnreported ? (
        <div className="flex gap-3 items-end">
          <div className="flex flex-col gap-1 flex-1">
            <label
              htmlFor={`count-${resource.id}`}
              className="text-xs text-slate-400 font-medium"
            >
              Current count (0 – {resource.total})
            </label>
            <input
              id={`count-${resource.id}`}
              type="number"
              min={0}
              max={resource.total}
              value={draftCount}
              onChange={e => setDraftCount(e.target.value)}
              disabled={isSaving}
              placeholder="0"
              className="
                w-full rounded-xl border border-slate-700 bg-slate-800 text-white
                px-4 py-3 text-lg tabular-nums
                focus-visible:outline-2 focus-visible:outline-cyan-700 focus-visible:outline-offset-2
                disabled:opacity-50
              "
            />
          </div>
          <button
            onClick={handleSaveDraft}
            disabled={isSaving || !draftValid}
            className="
              h-14 px-5 rounded-xl font-semibold text-sm
              bg-cyan-700 hover:bg-cyan-600 text-white
              disabled:opacity-40 disabled:cursor-not-allowed
              focus-visible:outline-2 focus-visible:outline-cyan-700 focus-visible:outline-offset-2
              transition-colors
            "
          >
            {isSaving ? 'Saving…' : 'Save count'}
          </button>
        </div>
      ) : (
        /* Reported: show +/- buttons */
        <div className="flex gap-3">
          <button
            aria-label={`Decrease ${resource.category}`}
            disabled={isSaving || (resource.available ?? 0) <= 0}
            onClick={() => onAdjust(resource, -1)}
            className="
              flex-1 min-h-14 h-14 sm:h-16 text-3xl font-bold rounded-2xl
              bg-slate-700 hover:bg-slate-600 text-white
              disabled:opacity-40 disabled:cursor-not-allowed
              focus-visible:outline-2 focus-visible:outline-cyan-700 focus-visible:outline-offset-2
              transition-colors active:scale-95
            "
          >
            −
          </button>
          <button
            aria-label={`Increase ${resource.category}`}
            disabled={isSaving || (resource.available ?? 0) >= resource.total}
            onClick={() => onAdjust(resource, +1)}
            className="
              flex-1 min-h-14 h-14 sm:h-16 text-3xl font-bold rounded-2xl
              bg-cyan-700 hover:bg-cyan-600 text-white
              disabled:opacity-40 disabled:cursor-not-allowed
              focus-visible:outline-2 focus-visible:outline-cyan-700 focus-visible:outline-offset-2
              transition-colors active:scale-95
            "
          >
            +
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main dashboard content ──────────────────────────────────────────────────

function DashboardContent() {
  const navigate = useNavigate()
  const [hospitalId, setHospitalId] = useState<string | null>(null)
  const [hospitalName, setHospitalName] = useState<string>('')
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)
  // Per-row error messages keyed by resource id
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  // Tracks which rows are mid-save to disable buttons
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  // "Confirm all counts" state
  const [confirming, setConfirming] = useState(false)
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  // Tick every minute to refresh "X min ago" labels
  const [, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(interval)
  }, [])

  // Load hospital id + name from staff_profiles
  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('staff_profiles')
        .select('hospital_id, hospitals(name)')
        .eq('user_id', user.id)
        .single()

      if (error || !data) {
        setProfileError('Could not load your profile.')
        setLoading(false)
        return
      }

      const hospital = data.hospitals as unknown as { name: string } | null
      setHospitalName(hospital?.name ?? 'Unknown hospital')
      setHospitalId(data.hospital_id)
    }

    fetchProfile()
  }, [])

  // Load resources once we have the hospital id
  const fetchResources = useCallback(async (hid: string) => {
    const { data, error } = await supabase
      .from('resources')
      .select('id, hospital_id, category, available, total, updated_at')
      .eq('hospital_id', hid)
      .order('category')

    if (error) {
      setProfileError('Could not load resources.')
    } else {
      setResources(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (hospitalId) fetchResources(hospitalId)
  }, [hospitalId, fetchResources])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/staff', { replace: true })
  }

  /** +/- button: optimistic update then save */
  async function adjustAvailable(resource: Resource, delta: number) {
    const prev = resource.available ?? 0
    const next = prev + delta
    if (next < 0 || next > resource.total) return

    setResources(rs => rs.map(r => r.id === resource.id ? { ...r, available: next } : r))
    setSaving(s => ({ ...s, [resource.id]: true }))
    setRowErrors(e => { const ne = { ...e }; delete ne[resource.id]; return ne })

    const { error } = await supabase
      .from('resources')
      .update({ available: next, updated_at: new Date().toISOString() })
      .eq('id', resource.id)

    if (error) {
      // Roll back
      setResources(rs => rs.map(r => r.id === resource.id ? { ...r, available: prev } : r))
      setRowErrors(e => ({ ...e, [resource.id]: 'Save failed – check your connection and try again.' }))
    } else {
      setResources(rs =>
        rs.map(r =>
          r.id === resource.id
            ? { ...r, available: next, updated_at: new Date().toISOString() }
            : r
        )
      )
    }

    setSaving(s => { const ns = { ...s }; delete ns[resource.id]; return ns })
  }

  /** Save count for an unreported row */
  async function saveCount(resource: Resource, count: number) {
    setSaving(s => ({ ...s, [resource.id]: true }))
    setRowErrors(e => { const ne = { ...e }; delete ne[resource.id]; return ne })

    const now = new Date().toISOString()
    const { error } = await supabase
      .from('resources')
      .update({ available: count, updated_at: now })
      .eq('id', resource.id)

    if (error) {
      setRowErrors(e => ({ ...e, [resource.id]: 'Save failed – check your connection and try again.' }))
    } else {
      setResources(rs =>
        rs.map(r =>
          r.id === resource.id
            ? { ...r, available: count, updated_at: now }
            : r
        )
      )
    }

    setSaving(s => { const ns = { ...s }; delete ns[resource.id]; return ns })
  }

  /** Re-save every reported row to refresh updated_at without changing counts */
  async function confirmAllCounts() {
    const reported = resources.filter(r => r.available !== null)
    if (reported.length === 0) return

    setConfirming(true)
    setConfirmMsg(null)
    setConfirmError(null)

    const now = new Date().toISOString()
    const updates = reported.map(r =>
      supabase
        .from('resources')
        .update({ available: r.available, updated_at: now })
        .eq('id', r.id)
    )

    const results = await Promise.all(updates)
    const anyError = results.some(res => res.error)

    if (anyError) {
      setConfirmError('Some counts could not be confirmed – please try again.')
    } else {
      setResources(rs =>
        rs.map(r =>
          r.available !== null ? { ...r, updated_at: now } : r
        )
      )
      setConfirmMsg('All counts confirmed just now')
    }

    setConfirming(false)
  }

  const oldest = oldestUpdatedAt(resources)

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col gap-5 p-4 sm:p-8 max-w-2xl mx-auto w-full">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 w-full">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
            {hospitalName || 'Staff Dashboard'}
          </h1>
          {hospitalName && (
            <p className="text-slate-400 text-sm mt-0.5">Staff Dashboard</p>
          )}
          {oldest && (
            <p className="text-slate-500 text-xs mt-1">
              Last confirmed: {timeAgo(oldest)}
            </p>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="
            bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold
            rounded-xl px-5 py-2.5 min-h-11
            focus-visible:outline-2 focus-visible:outline-cyan-700 focus-visible:outline-offset-2
            transition-colors
          "
        >
          Logout
        </button>
      </div>

      {/* ── Profile / network error ── */}
      {profileError && (
        <p role="alert" className="text-red-300 text-sm bg-red-950/50 border border-red-700 rounded-xl px-4 py-3 w-full">
          {profileError}
        </p>
      )}

      {/* ── Loading state ── */}
      {loading && (
        <p className="text-slate-500 text-sm">Loading resources…</p>
      )}

      {/* ── Resources loaded ── */}
      {!loading && !profileError && (
        <>
          {/* Confirm all counts button */}
          {resources.some(r => r.available !== null) && (
            <div className="flex flex-col gap-2">
              <button
                onClick={confirmAllCounts}
                disabled={confirming}
                className="
                  w-full min-h-14 rounded-2xl font-semibold text-base
                  bg-slate-700 hover:bg-slate-600 text-white
                  border border-slate-600
                  disabled:opacity-50 disabled:cursor-not-allowed
                  focus-visible:outline-2 focus-visible:outline-cyan-700 focus-visible:outline-offset-2
                  transition-colors
                "
              >
                {confirming ? 'Confirming…' : '✓  Counts are still correct'}
              </button>
              {confirmMsg && (
                <p className="text-green-400 text-sm text-center font-medium">{confirmMsg}</p>
              )}
              {confirmError && (
                <p role="alert" className="text-red-300 text-sm text-center font-medium">{confirmError}</p>
              )}
            </div>
          )}

          {/* Bed category rows */}
          <div className="flex flex-col gap-3 w-full">
            {resources.length === 0 && (
              <p className="text-slate-500 text-sm">No resources found for your hospital.</p>
            )}
            {resources.map(resource => (
              <BedRow
                key={resource.id}
                resource={resource}
                isSaving={!!saving[resource.id]}
                error={rowErrors[resource.id]}
                onAdjust={adjustAvailable}
                onSaveCount={saveCount}
              />
            ))}
          </div>
        </>
      )}
    </main>
  )
}

export default function StaffDashboard() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  )
}
