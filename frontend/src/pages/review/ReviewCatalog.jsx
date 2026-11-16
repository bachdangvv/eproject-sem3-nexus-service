import { useState } from 'react'
import { useAsyncResource } from '../../hooks/useAsyncResource'
import {
  fetchProductsApi, saveProductApi, archiveProductApi,
  fetchPlansApi, createPlanApi, updatePlanApi, archivePlanApi,
} from '../../services/review1Api'
import { Field, fieldClass, RequestState } from './ReviewPanel'

const empty = { name: '', description: '', active: true, type: 'BROADBAND', price: '' }

export default function ReviewCatalog({ plans = false }) {
  const { data, isLoading, error, reload } = useAsyncResource(() => plans ? fetchPlansApi(true) : fetchProductsApi(), [plans])
  const itemName = plans ? 'plan' : 'product'
  const [draft, setDraft] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [writeError, setWriteError] = useState('')

  async function write(action) {
    setBusy(true)
    setWriteError('')
    try {
      await action()
      setDraft(empty)
      reload()
    } catch (err) {
      setWriteError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function save(event) {
    event.preventDefault()
    const payload = {
      name: draft.name.trim(), description: draft.description.trim(), active: draft.active,
    }
    if (plans) {
      const plan = { ...payload, price: Number(draft.price), type: draft.type }
      write(() => draft.id ? updatePlanApi(draft.id, plan) : createPlanApi(plan))
    } else {
      write(() => saveProductApi(draft.id, payload))
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 p-4">
      <h2 className="text-lg font-bold">{plans ? 'Service plans' : 'Product catalog'}</h2>
      <form className="grid gap-3 md:grid-cols-2" onSubmit={save}>
        <Field label={plans ? 'Plan name' : 'Product name'}>
          <input className={fieldClass} required maxLength={100} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </Field>
        <Field label="Description">
          <input className={fieldClass} maxLength={240} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        </Field>
        {plans && <>
          <Field label="Service type">
            <select className={fieldClass} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
              <option value="BROADBAND">Broadband</option>
              <option value="DIAL_UP">Dial-up</option>
              <option value="SIP_TRUNK">Landline</option>
            </select>
          </Field>
          <Field label="Price (USD)">
            <input type="number" className={fieldClass} min="0" max="9999999999.99" step="0.01" required
              value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
          </Field>
        </>}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Active
        </label>
        <div className="flex gap-2">
          <button className="btn-primary" disabled={busy || !draft.name.trim()}>{draft.id ? `Save ${itemName}` : `Add ${itemName}`}</button>
          {draft.id && <button type="button" className="btn-outline" onClick={() => setDraft(empty)} disabled={busy}>Cancel edit</button>}
        </div>
      </form>
      <RequestState loading={isLoading || busy} error={writeError || error} />
      <ul className="divide-y divide-slate-200">
        {(data || []).map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
            <span><strong>{item.name}</strong> · {item.active ? 'Active' : 'Inactive'}
              {plans && ` · ${Number(item.price).toFixed(2)} USD`}{item.description && ` · ${item.description}`}
            </span>
            <div className="flex gap-2">
              <button className="btn-outline" disabled={busy} onClick={() => setDraft(item)}>Edit {item.name}</button>
              {item.active && <button className="btn-outline" disabled={busy}
                onClick={() => write(() => plans ? archivePlanApi(item.id) : archiveProductApi(item.id))}>Archive {item.name}</button>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
