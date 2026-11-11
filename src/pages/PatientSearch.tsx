// Public patient search page – shown at the root route (/)
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Hospital {
  id: string
  name: string
}

export default function PatientSearch() {
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchHospitals() {
      const { data, error } = await supabase
        .from('hospitals')
        .select('id, name')

      if (error) {
        setError(error.message)
      } else {
        setHospitals(data ?? [])
      }
      setLoading(false)
    }

    fetchHospitals()
  }, [])

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-4xl font-bold tracking-tight text-cyan-400">
        CareRoute
      </h1>
      <p className="text-slate-400 text-lg text-center max-w-md">
        Real-time hospital bed &amp; emergency resource availability for{' '}
        <span className="text-white font-semibold">Tumakuru</span>.
      </p>

      {loading && (
        <p className="text-slate-500 text-sm animate-pulse">Loading hospitals…</p>
      )}

      {error && (
        <p className="text-red-400 text-sm bg-red-950/40 border border-red-800 rounded px-4 py-2">
          Error: {error}
        </p>
      )}

      {!loading && !error && hospitals.length === 0 && (
        <p className="text-slate-600 text-sm italic">No hospitals found.</p>
      )}

      {!loading && !error && hospitals.length > 0 && (
        <ul className="w-full max-w-md divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden">
          {hospitals.map((h) => (
            <li key={h.id} className="px-4 py-3 text-slate-200 text-sm hover:bg-slate-800/60 transition-colors">
              {h.name}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
