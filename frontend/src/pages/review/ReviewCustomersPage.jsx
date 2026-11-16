import { useState } from 'react'
import RetailLayout from '../../components/layout/RetailLayout'
import AdminLayout from '../../components/layout/AdminLayout'
import { useAsyncResource } from '../../hooks/useAsyncResource'
import { fetchCustomersApi, fetchCitiesApi, createCustomerApi, updateCustomerApi } from '../../services/review1Api'
import ReviewPanel, { Field, fieldClass, RequestState } from './ReviewPanel'

const empty = { name: '', phone: '', address: '', cityCode: '', email: '', taxId: '', contactPerson: '' }
const fields = [
  ['name', 'Customer name', 120, true],
  ['phone', 'Phone', 16, true],
  ['address', 'Address', 240, true],
  ['email', 'Email', 160, false],
  ['taxId', 'Tax ID', 32, false],
  ['contactPerson', 'Contact person', 120, false],
]

export default function ReviewCustomersPage({ admin = false }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('')
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [writeError, setWriteError] = useState('')
  const [savedCode, setSavedCode] = useState('')
  const customers = useAsyncResource(() => fetchCustomersApi(filter), [filter])
  const cities = useAsyncResource(fetchCitiesApi)
  const Layout = admin ? AdminLayout : RetailLayout

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    setWriteError('')
    try {
      const saved = draft.id ? await updateCustomerApi(draft.id, draft) : await createCustomerApi(draft)
      setSavedCode(saved.customerId)
      setDraft(null)
      setQuery(saved.customerId)
      setFilter(saved.customerId)
      customers.reload()
    } catch (err) {
      setWriteError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layout activeNavId="customers" apiMode>
      <ReviewPanel title="Customers">
        <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); setFilter(query.trim()); customers.reload() }}>
          <Field label="Customer ID, name or phone">
            <input className={fieldClass} maxLength={120} value={query} onChange={(e) => setQuery(e.target.value)} />
          </Field>
          <button className="btn-primary">Find customer</button>
          <button type="button" className="btn-outline" disabled={busy} onClick={() => {
            setWriteError('')
            setDraft({ ...empty, cityCode: cities.data?.[0]?.code || '' })
          }}>New customer</button>
        </form>
        {savedCode && <p role="status" className="text-sm text-emerald-800">Saved {savedCode}</p>}
        {draft && (
          <form className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-2" onSubmit={save}>
            {fields.map(([key, label, maxLength, required]) => (
              <Field key={key} label={label}>
                <input className={fieldClass} required={required} maxLength={maxLength}
                  type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
                  value={draft[key] || ''} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
              </Field>
            ))}
            <Field label="City">
              <select className={fieldClass} required value={draft.cityCode} onChange={(e) => setDraft({ ...draft, cityCode: e.target.value })}>
                <option value="">Select city</option>
                {(cities.data || []).map((city) => <option key={city.code} value={city.code}>{city.code} · {city.name}</option>)}
              </select>
            </Field>
            <div className="flex items-end gap-2">
              <button className="btn-primary" disabled={busy || cities.isLoading}>Save customer</button>
              <button type="button" className="btn-outline" disabled={busy} onClick={() => setDraft(null)}>Cancel</button>
            </div>
          </form>
        )}
        <RequestState loading={busy || customers.isLoading} error={writeError || customers.error || cities.error} />
        {!customers.isLoading && !customers.data?.length && <p className="text-sm text-slate-600">No matching customers.</p>}
        <ul className="divide-y divide-slate-200">
          {(customers.data || []).map((customer) => (
            <li key={customer.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <span><strong>{customer.customerId} · {customer.name}</strong> · {customer.phone} · {customer.address}</span>
              <button className="btn-outline" disabled={busy} onClick={() => {
                setWriteError('')
                setDraft(customer)
              }}>Edit {customer.customerId}</button>
            </li>
          ))}
        </ul>
      </ReviewPanel>
    </Layout>
  )
}
