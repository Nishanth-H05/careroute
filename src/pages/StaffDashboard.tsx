// Staff dashboard – protected page; shows resource rows for the staff member's hospital with +/- controls
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import RequireAuth from '../components/RequireAuth'

interface Resource {
  id: string
  hospital_id: string
  category: string
  available: number
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

  async function adjustAvailable(resource: Resource, delta: number) {
    const next = resource.available + delta

    // Clamp
    if (next < 0 || next > resource.total) return

    // Optimistic update
    setResources(prev =>
      prev.map(r => r.id === resource.id ? { ...r, available: next } : r)
    )
    setSaving(prev => ({ ...prev, [resource.id]: true }))
    setRowErrors(prev => { const e = { ...prev }; delete e[resource.id]; return e })

    const { error } = await supabase
      .from('resources')
      .update({ available: next, updated_at: new Date().toISOString() })
      .eq('id', resource.id)

    if (error) {
      // Rollback optimistic update
      setResources(prev =>
        prev.map(r => r.id === resource.id ? { ...r, available: resource.available } : r)
      )
      setRowErrors(prev => ({
        ...prev,
        [resource.id]: 'Save failed – please try again.',
      }))
    } else {
      // Update local timestamp so staleness badge refreshes
      setResources(prev =>
        prev.map(r =>
          r.id === resource.id
            ? { ...r, available: next, updated_at: new Date().toISOString() }
            : r
        )
      )
    }

    setSaving(prev => { const s = { ...prev }; delete s[resource.id]; return s })
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-start gap-6 p-4 sm:p-8">
      {/* Header */}
      <div className="w-full flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-cyan-400">
            Staff Dashboard
          </h1>
          {hospitalName && (
            <p className="text-slate-400 text-sm mt-1">
              {hospitalName}
            </p>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-lg px-5 py-2 transition-colors"
        >
          Logout
        </button>
      </div>

      {/* Profile / network error */}
      {profileError && (
        <p className="text-red-400 text-sm bg-red-950/40 border border-red-800 rounded px-4 py-2 w-full">
          {profileError}
        </p>
      )}

      {/* Loading state */}
      {loading && (
        <p className="text-slate-500 animate-pulse text-sm">Loading resources…</p>
      )}

      {/* Resource list */}
      {!loading && !profileError && (
        <div className="w-full flex flex-col gap-3">
          {resources.length === 0 && (
            <p className="text-slate-500 text-sm">No resources found for your hospital.</p>
          )}

          {resources.map(resource => {
            const stale = isStale(resource.updated_at)
            const isSaving = !!saving[resource.id]
            const rowErr = rowErrors[resource.id]

            return (
              <div
                key={resource.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3"
              >
                {/* Top row: category + stale badge */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-white font-semibold text-base sm:text-lg capitalize">
                    {resource.category}
                  </span>
                  {stale && (
                    <span className="text-xs font-semibold bg-red-600 text-white rounded-full px-2 py-0.5 leading-tight">
                      Stale – please update
                    </span>
                  )}
                </div>

                {/* Middle row: available / total + time label */}
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="text-3xl font-bold text-cyan-300 tabular-nums">
                    {resource.available}
                    <span className="text-slate-400 text-lg font-normal">
                      {' '}/ {resource.total}
                    </span>
                  </span>
                  <span className="text-slate-500 text-xs">
                    Updated {timeAgo(resource.updated_at)}
                  </span>
                </div>

                {/* Per-row error */}
                {rowErr && (
                  <p className="text-red-400 text-xs bg-red-950/40 border border-red-800 rounded px-3 py-1.5">
                    {rowErr}
                  </p>
                )}

                {/* + / - buttons */}
                <div className="flex gap-3">
                  <button
                    aria-label={`Decrease ${resource.category}`}
                    disabled={isSaving || resource.available <= 0}
                    onClick={() => adjustAvailable(resource, -1)}
                    className="
                      flex-1 h-14 sm:h-16 text-3xl font-bold rounded-xl
                      bg-slate-700 hover:bg-slate-600
                      disabled:opacity-40 disabled:cursor-not-allowed
                      transition-colors active:scale-95
                    "
                  >
                    −
                  </button>
                  <button
                    aria-label={`Increase ${resource.category}`}
                    disabled={isSaving || resource.available >= resource.total}
                    onClick={() => adjustAvailable(resource, +1)}
                    className="
                      flex-1 h-14 sm:h-16 text-3xl font-bold rounded-xl
                      bg-cyan-700 hover:bg-cyan-600
                      disabled:opacity-40 disabled:cursor-not-allowed
                      transition-colors active:scale-95
                    "
                  >
                    +
                  </button>
                </div>
              </div>
            )
          })}
        </div>
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
