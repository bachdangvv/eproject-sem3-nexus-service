import { useState } from 'react'
import { Wrench, X, Truck, Calendar, Clock, Download, CheckCircle2 } from 'lucide-react'
import { downloadWorkOrderDocument } from '../../utils/telecomDocumentGenerator'

export default function DispatchTechnicianModal({ order, onClose, onDispatched }) {
  if (!order) return null

  const ticketId = `DSP-${order.branchCode || '101'}-${Date.now().toString().slice(-5)}`
  const [technicianName, setTechnicianName] = useState('Nguyen Van Tuan (Senior Splicer #HN-42)')
  const [vehicle, setVehicle] = useState('Van #29C-881.24 (OTDR Anritsu + Fujikura 90S Splicer)')
  const [windowTime, setWindowTime] = useState('Today 14:00 - 16:00 (NOC 4-Hour SLA)')
  const [notes, setNotes] = useState('Verify ODN pole junction, measure attenuation target < -24 dBm, install dual-band ONT.')

  const handleConfirmDispatch = (e) => {
    e.preventDefault()

    const dispatchDetails = {
      ticketId,
      technicianName,
      vehicle,
      window: windowTime,
      notes,
      dispatchedAt: new Date().toISOString(),
    }

    // Download official work order document
    downloadWorkOrderDocument(order, dispatchDetails)

    onDispatched?.(ticketId, dispatchDetails)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-7 space-y-5 my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 font-bold border border-indigo-100">
              <Wrench size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-navy">Dispatch Field Engineering Crew</h3>
              <p className="text-xs text-slate-500">
                Ticket ID: <span className="font-mono font-bold text-indigo-600">#{ticketId}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-1.5 text-xs text-slate-700">
          <div className="flex justify-between">
            <span className="text-slate-500">Subscriber:</span>
            <strong className="text-slate-900">{order.customerName}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Service Plan:</span>
            <strong className="text-indigo-700">{order.planName}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Premise Address:</span>
            <span className="text-slate-800 text-right font-medium max-w-[280px]">{order.address}</span>
          </div>
        </div>

        <form onSubmit={handleConfirmDispatch} className="space-y-4 text-xs">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Assigned Field Technician
            </label>
            <select
              value={technicianName}
              onChange={(e) => setTechnicianName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 text-slate-800 bg-white"
            >
              <option value="Nguyen Van Tuan (Senior Splicer #HN-42)">Nguyen Van Tuan (Senior Splicer #HN-42)</option>
              <option value="Tran Minh Duc (Optical Specialist #HN-19)">Tran Minh Duc (Optical Specialist #HN-19)</option>
              <option value="Pham Quoc Huy (FTTx Field Lead #HN-08)">Pham Quoc Huy (FTTx Field Lead #HN-08)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Vehicle &amp; Tools Package
              </label>
              <select
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 text-slate-800 bg-white"
              >
                <option value="Van #29C-881.24 (OTDR Anritsu + Fujikura 90S Splicer)">Van #29C-881.24 (OTDR + Splicer)</option>
                <option value="Van #29C-740.11 (Fiber Fault Locator + VFL Toolkit)">Van #29C-740.11 (Fault Locator)</option>
                <option value="Rapid Response Motorcycle Unit #HN-92">Rapid Motorcycle Unit #HN-92</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Dispatch Schedule Window
              </label>
              <select
                value={windowTime}
                onChange={(e) => setWindowTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 text-slate-800 bg-white"
              >
                <option value="Today 14:00 - 16:00 (NOC 4-Hour SLA)">Today 14:00 - 16:00 (NOC 4-Hour SLA)</option>
                <option value="Tomorrow Morning 08:30 - 10:30">Tomorrow Morning 08:30 - 10:30</option>
                <option value="Tomorrow Afternoon 14:00 - 16:00">Tomorrow Afternoon 14:00 - 16:00</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Field Work Instructions &amp; Safety Protocol
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 text-slate-800"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-700 transition cursor-pointer"
            >
              <Download size={14} />
              <span>Confirm &amp; Download Work Order</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

