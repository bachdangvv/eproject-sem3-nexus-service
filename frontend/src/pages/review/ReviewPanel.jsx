import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { logout } from '../../services/authService'

export const fieldClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm'

export default function ReviewPanel({ title, children }) {
  const navigate = useNavigate()
  const [error, setError] = useState('')

  async function signOut() {
    try {
      await logout()
      navigate('/login')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-navy">{title}</h1>
        <button type="button" className="btn-outline" onClick={signOut}>Sign out</button>
      </div>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {children}
    </section>
  )
}

export function Field({ label, children }) {
  return <label className="grid gap-1 text-sm font-medium text-slate-700">{label}{children}</label>
}

export function RequestState({ loading, error }) {
  if (loading) return <p role="status">Loading…</p>
  if (error) return <p role="alert" className="text-sm text-rose-700">{error}</p>
  return null
}
