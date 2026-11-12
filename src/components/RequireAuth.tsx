// Protected route wrapper – redirects unauthenticated users to /staff
import { useEffect, useState, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function RequireAuth({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate('/staff', { replace: true })
      }
      setChecking(false)
    })
  }, [navigate])

  if (checking) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-slate-500 animate-pulse text-sm">Checking session…</p>
      </main>
    )
  }

  return <>{children}</>
}
