// Staff login page – shown at /staff; account creation is admin-only (see SPEC.md)
export default function StaffLogin() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-bold tracking-tight text-cyan-400">
        Staff Portal
      </h1>
      <p className="text-slate-400 text-sm text-center max-w-xs">
        Hospital staff only. Accounts are created by an admin — no self-signup.
      </p>
      <p className="text-sm text-slate-600 italic">
        Login form coming soon…
      </p>
    </main>
  )
}
