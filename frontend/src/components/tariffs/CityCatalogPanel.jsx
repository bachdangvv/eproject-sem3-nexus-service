import { useState, useMemo, useEffect } from 'react'
import { MapPin, Plus, Search, X, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useAsyncResource } from '../../hooks/useAsyncResource'
import { useToast } from '../../hooks/useToast'
import { fetchCitiesApi, createCityApi } from '../../services/review1Api'

const EMPTY_CITY = { code: '', name: '' }
const CITY_CODE_REGEX = /^[0-9]{3}$/

/** Enterprise Service Cities Directory backed by Review 1 `/api/cities`. */
export default function CityCatalogPanel() {
  const { data: citiesData, isLoading, error, reload } = useAsyncResource(fetchCitiesApi, [])
  const cities = citiesData || []
  const [searchQuery, setSearchQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [draft, setDraft] = useState(EMPTY_CITY)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const { toast, showToast } = useToast()

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#cities') {
      document.getElementById('cities')?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  const filteredCities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return cities.filter(
      (city) =>
        !q ||
        (city.code || '').toLowerCase().includes(q) ||
        (city.name || '').toLowerCase().includes(q)
    )
  }, [cities, searchQuery])

  function openCreate() {
    setDraft(EMPTY_CITY)
    setFormError('')
    setModalOpen(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (busy) return
    const cleanCode = draft.code.trim()
    const cleanName = draft.name.trim()
    if (!CITY_CODE_REGEX.test(cleanCode)) {
      setFormError('City code must be exactly 3 numeric digits (e.g. 201 or 301).')
      return
    }
    if (!cleanName) {
      setFormError('City name is required.')
      return
    }
    setBusy(true)
    setFormError('')
    try {
      const saved = await createCityApi({ code: cleanCode, name: cleanName })
      setModalOpen(false)
      setDraft(EMPTY_CITY)
      reload()
      showToast(`Added service city "${saved.code} - ${saved.name}".`)
    } catch (err) {
      setFormError(err?.message || 'Unable to create city.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div id="cities" className="space-y-4">
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-2xl border border-slate-700">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{toast.message}</span>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Add Service City</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                aria-label="Close city modal"
              >
                <X size={16} />
              </button>
            </div>

            {formError && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  3-Digit City Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={3}
                  value={draft.code}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value.replace(/[^\d]/g, '').slice(0, 3) })}
                  placeholder="e.g. 201"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-600"
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  Used in characters 2–4 of generated 16-character Account IDs.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  City / Metro Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. Ho Chi Minh City"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-indigo-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={busy}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || draft.code.trim().length !== 3 || !draft.name.trim()}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer disabled:opacity-50"
                >
                  {busy ? 'Saving...' : 'Add City'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <MapPin size={16} />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-navy">Service Cities Directory</h2>
              <p className="text-[11px] text-slate-500">
                3-digit regional codes used in Customer profiles and 16-char Account IDs (`/api/cities`)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-52">
              <Search size={13} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter city code or name..."
                className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pr-3 pl-8 text-xs font-medium text-slate-700 outline-none focus:border-indigo-600"
              />
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 transition cursor-pointer"
            >
              <Plus size={14} />
              <span>Add City</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="m-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-400">
                <th className="py-3 px-4">City Code (3 Digits)</th>
                <th className="py-3 px-4">City / Metro Name</th>
                <th className="py-3 px-4">Account ID Sample</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-xs text-slate-400">
                    Loading service cities...
                  </td>
                </tr>
              ) : filteredCities.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-xs text-slate-400">
                    No service cities match the current filter.
                  </td>
                </tr>
              ) : (
                filteredCities.map((city) => (
                  <tr key={city.code} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-700">{city.code}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{city.name}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      B{city.code}000000000001
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
