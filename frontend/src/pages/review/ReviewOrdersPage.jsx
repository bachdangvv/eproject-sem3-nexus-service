import { useState } from 'react'
import { useSearchParams, useParams } from 'react-router-dom'
import RetailLayout from '../../components/layout/RetailLayout'
import TechnicalLayout from '../../components/layout/TechnicalLayout'
import { useAsyncResource } from '../../hooks/useAsyncResource'
import {
  fetchOrdersApi, fetchOrderDetailApi, assessOrderApi, connectOrderApi, recordFeedbackApi,
} from '../../services/review1Api'
import ReviewPanel, { Field, fieldClass, RequestState } from './ReviewPanel'

const labels = {
  PENDING_SURVEY: 'Pending', FEASIBLE: 'Feasible', NOT_FEASIBLE: 'Not feasible', ACTIVATED: 'Connected',
}

function AssessmentForm({ order, submit, busy }) {
  const [distanceOk, setDistanceOk] = useState(true)
  const [serverAvailable, setServerAvailable] = useState(true)
  const [landlineFeasible, setLandlineFeasible] = useState(true)
  const [note, setNote] = useState('')
  const checkLandline = order.serviceType === 'DIALUP' && !order.hasNexusLandline
  const feasible = distanceOk && serverAvailable && (!checkLandline || landlineFeasible)
  return (
    <form className="grid gap-3" onSubmit={(e) => {
      e.preventDefault()
      submit(() => assessOrderApi(order.id, {
        distanceOk, serverAvailable, landlineFeasible: checkLandline ? landlineFeasible : null, note: note.trim(),
      }))
    }}>
      <label className="flex gap-2"><input type="checkbox" checked={distanceOk} onChange={(e) => setDistanceOk(e.target.checked)} /> Distance within limit</label>
      <label className="flex gap-2"><input type="checkbox" checked={serverAvailable} onChange={(e) => setServerAvailable(e.target.checked)} /> Server available</label>
      {checkLandline && <label className="flex gap-2"><input type="checkbox" checked={landlineFeasible} onChange={(e) => setLandlineFeasible(e.target.checked)} /> Landline feasible</label>}
      <Field label={feasible ? 'Assessment note' : 'Reason for rejection'}>
        <textarea className={fieldClass} required={!feasible} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div><button className="btn-primary" disabled={busy || (!feasible && !note.trim())}>Save assessment</button></div>
    </form>
  )
}

function FeedbackForm({ order, submit, busy }) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  return (
    <form className="grid gap-3" onSubmit={(e) => {
      e.preventDefault()
      submit(async () => {
        await recordFeedbackApi(order.id, { rating, comment: comment.trim() })
        setComment('')
      })
    }}>
      <Field label="Rating">
        <select className={fieldClass} value={rating} onChange={(e) => setRating(Number(e.target.value))}>
          {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </Field>
      <Field label="Feedback">
        <textarea className={fieldClass} required maxLength={600} value={comment} onChange={(e) => setComment(e.target.value)} />
      </Field>
      <div><button className="btn-primary" disabled={busy || !comment.trim()}>Save feedback</button></div>
    </form>
  )
}

export default function ReviewOrdersPage({ mode = 'retail' }) {
  const { orderId } = useParams()
  const [params, setParams] = useSearchParams()
  const selected = params.get('code') || orderId || ''
  const [query, setQuery] = useState(selected)
  const [busy, setBusy] = useState(false)
  const [writeError, setWriteError] = useState('')
  const { data: orders, isLoading, error, reload } = useAsyncResource(() => fetchOrdersApi({
    status: mode === 'survey' ? 'PENDING_SURVEY' : mode === 'activation' ? 'FEASIBLE' : '',
  }), [mode])
  const detail = useAsyncResource(() => selected ? fetchOrderDetailApi(selected) : null, [selected])
  const order = detail.data?.id === selected ? detail.data : null
  const Layout = mode === 'retail' ? RetailLayout : TechnicalLayout
  const nav = mode === 'retail' ? 'orders' : mode === 'survey' ? 'surveys' : 'activations'
  const title = mode === 'retail' ? 'Orders' : mode === 'survey' ? 'Technical survey' : 'Connections'

  function select(code) {
    setWriteError('')
    setQuery(code)
    setParams(code ? { code } : {})
  }

  async function submit(action) {
    setBusy(true)
    setWriteError('')
    try {
      await action()
      detail.reload()
      reload()
    } catch (err) {
      setWriteError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layout activeNavId={nav} apiMode>
      <ReviewPanel title={title}>
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); select(query.trim().toUpperCase()) }}>
          <Field label="Order ID">
            <input className={fieldClass} value={query} onChange={(e) => setQuery(e.target.value)} maxLength={11} required pattern="[BbDdTt][0-9]{10}" />
          </Field>
          <button className="btn-primary" disabled={busy}>Find order</button>
        </form>
        <RequestState loading={isLoading} error={error} />
        {!isLoading && !orders?.length && <p className="text-sm text-slate-600">No orders in this queue.</p>}
        <div className="flex flex-wrap gap-2">
          {(orders || []).map((row) => (
            <button key={row.id} className="btn-outline" disabled={busy} onClick={() => select(row.id)}>{row.id} · {row.customerName}</button>
          ))}
        </div>
        {selected && (
          <RequestState loading={detail.isLoading || busy} error={writeError || (detail.error && `Unable to open order ${selected}. ${detail.error}`)} />
        )}
        {order && (
          <section className="space-y-4 rounded-lg border border-slate-200 p-4 text-sm">
            <div>
              <h2 className="font-bold">{order.id} · {labels[order.status]}</h2>
              <p>{order.customerName} · {order.planName}</p>
              <p>{order.address}</p>
              {order.accountId && <p>Account ID: <strong>{order.accountId}</strong></p>}
            </div>
            <div>
              <h3 className="font-bold">Status history</h3>
              <ul className="list-inside list-disc">
                {order.history.map((entry, index) => (
                  <li key={index}>{labels[entry.status] || entry.status} · {entry.actor} · {new Date(entry.at).toLocaleString()}{entry.note ? ` · ${entry.note}` : ''}</li>
                ))}
              </ul>
            </div>
            {mode === 'survey' && order.status === 'PENDING_SURVEY' &&
              <AssessmentForm key={order.id} order={order} submit={submit} busy={busy || detail.isLoading} />}
            {mode === 'activation' && order.status === 'FEASIBLE' &&
              <button className="btn-primary" disabled={busy || detail.isLoading} onClick={() => submit(() => connectOrderApi(order.id))}>Create connection</button>}
            {mode === 'retail' && order.status === 'ACTIVATED' && (
              <>
                <h3 className="font-bold">Feedback</h3>
                <FeedbackForm key={order.id} order={order} submit={submit} busy={busy || detail.isLoading} />
                <ul className="space-y-1">
                  {order.feedback.map((entry, index) => <li key={index}>{entry.rating}/5 · {entry.comment}</li>)}
                </ul>
              </>
            )}
          </section>
        )}
      </ReviewPanel>
    </Layout>
  )
}
