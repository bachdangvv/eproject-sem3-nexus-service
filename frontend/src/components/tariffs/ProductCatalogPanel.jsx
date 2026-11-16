import { useState, useMemo } from 'react'
import { Package, Plus, Edit3, Archive, Search, X, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useAsyncResource } from '../../hooks/useAsyncResource'
import { useToast } from '../../hooks/useToast'
import { fetchProductsApi, saveProductApi, archiveProductApi } from '../../services/review1Api'

const EMPTY_PRODUCT = { id: null, name: '', description: '', active: true }

/** Enterprise Product Catalog CRUD panel backed by Review 1 `/api/products`. */
export default function ProductCatalogPanel() {
  const { data: productsData, isLoading, error, reload } = useAsyncResource(fetchProductsApi, [])
  const products = productsData || []
  const [searchQuery, setSearchQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [draft, setDraft] = useState(EMPTY_PRODUCT)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const { toast, showToast } = useToast()

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return products.filter((item) =>
      !q ||
      (item.name || '').toLowerCase().includes(q) ||
      (item.description || '').toLowerCase().includes(q)
    )
  }, [products, searchQuery])

  function openCreate() {
    setDraft(EMPTY_PRODUCT)
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(item) {
    setDraft({
      id: item.id,
      name: item.name || '',
      description: item.description || '',
      active: item.active !== false,
    })
    setFormError('')
    setModalOpen(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setFormError('')
    try {
      const saved = await saveProductApi(draft.id, {
        name: draft.name.trim(),
        description: draft.description.trim(),
        active: Boolean(draft.active),
      })
      setModalOpen(false)
      setDraft(EMPTY_PRODUCT)
      reload()
      showToast(draft.id ? `Updated product "${saved.name}".` : `Added product "${saved.name}" to catalog.`)
    } catch (err) {
      setFormError(err?.message || 'Unable to save product.')
    } finally {
      setBusy(false)
    }
  }

  async function handleArchive(item) {
    if (busy) return
    setBusy(true)
    try {
      await archiveProductApi(item.id)
      reload()
      showToast(`Archived product "${item.name}".`)
    } catch (err) {
      showToast(err?.message || 'Unable to archive product.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
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
              <h3 className="text-sm font-bold text-slate-900">
                {draft.id ? 'Edit Catalog Product' : 'Add Product to Catalog'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                aria-label="Close product modal"
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
                  Product Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. Review 1 Router"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  maxLength={240}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="Hardware model, ports, or deployment note"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-indigo-600"
                />
              </div>

              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Active in catalog</span>
              </label>

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
                  disabled={busy || !draft.name.trim()}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer disabled:opacity-50"
                >
                  {busy ? 'Saving...' : draft.id ? 'Save Product' : 'Add Product'}
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
              <Package size={16} />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-navy">Hardware &amp; Product Catalog</h2>
              <p className="text-[11px] text-slate-500">
                Carrier equipment catalog synced with Review 1 backend (`/api/products`)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-56">
              <Search size={13} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter products..."
                className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pr-3 pl-8 text-xs font-medium text-slate-700 outline-none focus:border-indigo-600"
              />
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-xl bg-navy px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 shadow-xs transition cursor-pointer"
            >
              <Plus size={14} />
              <span>Add Product</span>
            </button>
          </div>
        </div>

        {error ? (
          <div className="p-4 text-xs font-semibold text-rose-700">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="border-b border-slate-100 bg-slate-50/60 font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-400">Loading product catalog...</td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-400">No products found.</td>
                  </tr>
                ) : (
                  filteredProducts.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-indigo-700">#{item.id}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{item.name}</td>
                      <td className="px-4 py-3 text-slate-500">{item.description || '—'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                            item.active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {item.active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => openEdit(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition cursor-pointer"
                        >
                          <Edit3 size={11} /> Edit
                        </button>
                        {item.active && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleArchive(item)}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100 transition cursor-pointer"
                          >
                            <Archive size={11} /> Archive
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

