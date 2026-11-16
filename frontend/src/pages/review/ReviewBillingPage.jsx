import { useState } from 'react'
import AccountsLayout from '../../components/layout/AccountsLayout'
import { fetchBillingApi, saveBillingApi } from '../../services/review1Api'
import ReviewPanel, { Field, fieldClass, RequestState } from './ReviewPanel'

export default function ReviewBillingPage() {
  const [accountId, setAccountId] = useState('')
  const [record, setRecord] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(action) {
    setError('')
    setBusy(true)
    if (action === 'lookup') setRecord(null)
    try {
      setRecord(action === 'lookup'
        ? await fetchBillingApi(accountId.trim().toUpperCase())
        : await saveBillingApi(record.accountId, action === 'pay'))
    } catch (err) {
      setError(err.response?.status === 404 ? 'Connected account not found.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AccountsLayout activeNavId="invoices" apiMode>
      <ReviewPanel title="Billing & payment">
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); run('lookup') }}>
          <Field label="Account ID">
            <input className={fieldClass} maxLength={16} pattern="[BbDdTt][0-9]{15}" required disabled={busy}
              value={accountId} onChange={(e) => { setAccountId(e.target.value); setRecord(null) }} />
          </Field>
          <button className="btn-primary" disabled={busy}>Find account</button>
        </form>
        <RequestState loading={busy} error={error} />
        {record && (
          <div className="space-y-3 rounded-lg border border-slate-200 p-4 text-sm">
            <p><strong>{record.accountId}</strong> · Order {record.orderId}</p>
            <p>{record.customerName} · {record.planName}</p>
            <p>Amount: <strong>{Number(record.amount).toFixed(2)} USD</strong></p>
            <p role="status">Status: <strong>{record.status === 'NotBilled' ? 'Not billed' : record.status}</strong></p>
            {record.status === 'NotBilled' && <button className="btn-primary" disabled={busy} onClick={() => run('create')}>Create billing record</button>}
            {record.status === 'Unpaid' && <button className="btn-primary" disabled={busy} onClick={() => run('pay')}>Record full manual payment</button>}
            {record.paidAt && <p>Paid at {new Date(record.paidAt).toLocaleString()}</p>}
          </div>
        )}
      </ReviewPanel>
    </AccountsLayout>
  )
}
