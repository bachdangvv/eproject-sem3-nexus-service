import { useState } from 'react'
import AdminLayout from '../../components/layout/AdminLayout'
import { useAsyncResource } from '../../hooks/useAsyncResource'
import { fetchEmployeesApi, createEmployeeApi } from '../../services/review1Api'
import ReviewPanel, { Field, fieldClass, RequestState } from './ReviewPanel'

const empty = { username: '', displayName: '', role: 'Retail', password: '' }

export default function ReviewUsersPage() {
  const { data, error, isLoading, reload } = useAsyncResource(fetchEmployeesApi)
  const [draft, setDraft] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [writeError, setWriteError] = useState('')
  const [created, setCreated] = useState('')

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    setCreated('')
    setWriteError('')
    try {
      const employee = await createEmployeeApi(draft)
      setDraft(empty)
      setCreated(employee.username)
      reload()
    } catch (err) {
      setWriteError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminLayout activeNavId="users" apiMode>
      <ReviewPanel title="Employee accounts">
        <form className="grid gap-3 md:grid-cols-2" onSubmit={save}>
          <Field label="Username">
            <input className={fieldClass} required pattern="[a-zA-Z0-9._\-]{3,40}" maxLength={40} value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} />
          </Field>
          <Field label="Display name">
            <input className={fieldClass} required maxLength={100} value={draft.displayName} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} />
          </Field>
          <Field label="Role">
            <select className={fieldClass} value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>
              {['Admin', 'Retail', 'Technical', 'Billing'].map((role) => <option key={role}>{role}</option>)}
            </select>
          </Field>
          <Field label="Initial password (at least 12 characters)">
            <input className={fieldClass} type="password" autoComplete="new-password" required minLength={12} maxLength={128}
              value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} />
          </Field>
          <div><button className="btn-primary" disabled={busy}>Create employee</button></div>
        </form>
        {created && <p role="status" className="text-sm text-emerald-800">Created {created}</p>}
        <RequestState loading={busy || isLoading} error={writeError || error} />
        <ul className="divide-y divide-slate-200">
          {(data || []).map((user) => <li key={user.id} className="py-2 text-sm">{user.username} · {user.displayName} · {user.role === 'ACCOUNTS' ? 'Billing' : user.role}</li>)}
        </ul>
      </ReviewPanel>
    </AdminLayout>
  )
}
