import { useState } from 'react'
import { Link } from 'react-router-dom'
import RetailLayout from '../../components/layout/RetailLayout'
import { useAsyncResource } from '../../hooks/useAsyncResource'
import {
  confirmRequestApi, createRequestApi, fetchCustomersApi, fetchPlansApi, fetchRequestsApi,
} from '../../services/review1Api'
import ReviewPanel, { Field, fieldClass, RequestState } from './ReviewPanel'

export default function ReviewRequestsPage() {
  const { data, isLoading, error, reload } = useAsyncResource(() =>
    Promise.all([fetchCustomersApi(), fetchPlansApi(), fetchRequestsApi()]))
  const [customers, plans, requests] = data || [[], [], []]
  const [customerId, setCustomerId] = useState('')
  const [planId, setPlanId] = useState('')
  const [hasLandline, setHasLandline] = useState(false)
  const [order, setOrder] = useState(null)
  const [busy, setBusy] = useState(false)
  const [writeError, setWriteError] = useState('')
  const isDialup = plans.find((plan) => plan.id === planId)?.type === 'DIAL_UP'

  async function write(action) {
    setBusy(true)
    setWriteError('')
    try {
      await action()
      reload()
    } catch (err) {
      setWriteError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <RetailLayout activeNavId="new-order" apiMode>
      <ReviewPanel title="Service requests">
        <Link className="text-sm font-semibold text-brand-soft" to="/retail/customers">Create or edit a customer</Link>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => {
          event.preventDefault()
          write(async () => {
            await createRequestApi({ customerId: Number(customerId), planId: Number(planId), hasNexusLandline: isDialup && hasLandline })
            setOrder(null)
          })
        }}>
          <Field label="Customer">
            <select required className={fieldClass} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select a customer</option>
              {customers.filter((customer) => customer.status === 'ACTIVE').map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.customerId} · {customer.customerName}</option>
              ))}
            </select>
          </Field>
          <Field label="Service plan">
            <select required className={fieldClass} value={planId} onChange={(e) => { setPlanId(e.target.value); setHasLandline(false) }}>
              <option value="">Select an active plan</option>
              {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {plan.priceUSD} USD</option>)}
            </select>
          </Field>
          {isDialup && <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hasLandline} onChange={(e) => setHasLandline(e.target.checked)} /> Customer already has a Nexus landline
          </label>}
          <div><button className="btn-primary" disabled={busy || isLoading}>Save request</button></div>
        </form>
        <RequestState loading={busy || isLoading} error={writeError || error} />
        {order && <p role="status" className="text-sm text-emerald-800">
          Order <Link className="font-bold underline" to={`/retail/orders?code=${order.id}`}>{order.id}</Link> created. Status: Pending.
        </p>}
        <h2 className="font-bold">Awaiting confirmation</h2>
        {!isLoading && !requests.length && <p className="text-sm text-slate-600">No pending requests.</p>}
        <ul className="divide-y divide-slate-200">
          {requests.map((request) => (
            <li key={request.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <span>#{request.id} · {request.customerName} · {request.planName}</span>
              <button className="btn-outline" disabled={busy} onClick={() => write(async () => setOrder(await confirmRequestApi(request.id)))}>
                Confirm request #{request.id}
              </button>
            </li>
          ))}
        </ul>
      </ReviewPanel>
    </RetailLayout>
  )
}
