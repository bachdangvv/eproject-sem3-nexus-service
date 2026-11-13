import { useState, useRef } from 'react'
import {
  UploadCloud,
  CheckCircle2,
  FileText,
  AlertTriangle,
  Trash2,
  RefreshCw,
  Image as ImageIcon,
  FileUp,
  Download,
  CreditCard,
  MapPin,
  Receipt,
  Banknote,
} from 'lucide-react'
import {
  DEPOSIT_COLLECTION_METHODS,
  buildDepositReceiptNumber,
  resolveDepositCollectionMethodLabel,
} from '../../../services/orderService'

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png']
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function validateFile(file) {
  if (!file) return { valid: false, error: 'No file selected.' }

  const ext = '.' + file.name.split('.').pop().toLowerCase()
  const isTypeValid = ALLOWED_TYPES.includes(file.type) || ALLOWED_EXTENSIONS.includes(ext)
  if (!isTypeValid) {
    return {
      valid: false,
      error: `Invalid file format "${ext}". Only PDF, JPG, and PNG files are accepted.`,
    }
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
    return {
      valid: false,
      error: `File is too large (${sizeMB}MB). Maximum allowed size is 10MB.`,
    }
  }

  return { valid: true, error: null }
}

function createFilePreviewUrl(file) {
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    return URL.createObjectURL(file)
  }
  return null
}

function revokeFilePreviewUrl(fileObj) {
  if (fileObj?.previewUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(fileObj.previewUrl)
  }
}

function DocumentUploadCard({
  title,
  subtitle,
  icon: IconComponent,
  file,
  error,
  isDragging,
  inputRef,
  onSelectFile,
  onRemoveFile,
  onDragChange,
}) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 transition">
      <div>
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-indigo-50 p-1.5 text-brand-soft">
              <IconComponent size={16} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-navy">{title}</h4>
              <span className="text-[10px] text-slate-400">{subtitle}</span>
            </div>
          </div>
          {file ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
              <CheckCircle2 size={11} /> ATTACHED
            </span>
          ) : (
            <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
              REQUIRED
            </span>
          )}
        </div>

        <input
          type="file"
          ref={inputRef}
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/png,image/jpeg"
          onChange={(e) => onSelectFile(e.target.files?.[0])}
          className="hidden"
        />

        {file ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 space-y-2 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-brand-soft shrink-0">
                {file.name.toLowerCase().endsWith('.pdf') ? (
                  <FileText size={18} />
                ) : (
                  <ImageIcon size={18} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-bold text-slate-900" title={file.name}>
                  {file.name}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <span>{formatFileSize(file.size)}</span>
                  <span>&bull;</span>
                  <span className="uppercase">{file.name.split('.').pop()}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              {(file.previewUrl || file.dataUrl) && (
                <>
                  <a
                    href={file.previewUrl || file.dataUrl}
                    download={file.name}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition"
                  >
                    <Download size={11} />
                    <span>Download</span>
                  </a>
                  <span className="text-slate-300">|</span>
                </>
              )}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-navy cursor-pointer transition"
              >
                <RefreshCw size={11} />
                <span>Replace</span>
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={onRemoveFile}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer transition"
              >
                <Trash2 size={11} />
                <span>Delete</span>
              </button>
            </div>
          </div>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault()
              onDragChange(true)
            }}
            onDragLeave={() => onDragChange(false)}
            onDrop={(e) => {
              e.preventDefault()
              onDragChange(false)
              onSelectFile(e.dataTransfer.files?.[0])
            }}
            className={`mt-3 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition ${
              isDragging
                ? 'border-brand-soft bg-indigo-50/50'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="rounded-full bg-slate-50 p-2 text-slate-400 mb-1">
              <UploadCloud size={20} />
            </div>
            <div className="text-xs font-bold text-slate-700">Choose file or drag &amp; drop</div>
            <div className="text-[10px] text-slate-400 mt-0.5">PDF, JPG, or PNG up to 10MB</div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-navy px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition cursor-pointer shadow-xs"
            >
              <FileUp size={12} />
              <span>Browse Document</span>
            </button>
          </div>
        )}

        {error && (
          <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-600 border border-rose-200">
            <AlertTriangle size={12} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function DocumentStep({
  nationalIdFile: propNationalIdFile,
  setNationalIdFile: propSetNationalIdFile,
  addressProofFile: propAddressProofFile,
  setAddressProofFile: propSetAddressProofFile,
  setHasUploadedNationalId,
  setHasUploadedAddressProof,
  agreedToTerms,
  setAgreedToTerms,
  odnCheckResult,
  handleRunODNCheck,
  isCheckingODN,
  generatedOrderId = '',
  financialCalculations = null,
  depositMethod = 'CASH',
  setDepositMethod,
  depositConfirmed = false,
  setDepositConfirmed,
  depositReference = '',
  setDepositReference,
  depositCollector = '',
  setDepositCollector,
}) {
  const [localNationalIdFile, setLocalNationalIdFile] = useState(null)
  const [localAddressProofFile, setLocalAddressProofFile] = useState(null)

  const [nationalIdError, setNationalIdError] = useState(null)
  const [addressProofError, setAddressProofError] = useState(null)
  const [isDraggingNationalId, setIsDraggingNationalId] = useState(false)
  const [isDraggingAddressProof, setIsDraggingAddressProof] = useState(false)

  const nationalIdInputRef = useRef(null)
  const addressProofInputRef = useRef(null)

  const currentNationalIdFile = propNationalIdFile !== undefined ? propNationalIdFile : localNationalIdFile
  const currentAddressProofFile = propAddressProofFile !== undefined ? propAddressProofFile : localAddressProofFile

  function updateNationalIdFile(fileObj) {
    if (currentNationalIdFile?.previewUrl && currentNationalIdFile.previewUrl !== fileObj?.previewUrl) {
      revokeFilePreviewUrl(currentNationalIdFile)
    }
    if (propSetNationalIdFile) {
      propSetNationalIdFile(fileObj)
    } else {
      setLocalNationalIdFile(fileObj)
    }
    setHasUploadedNationalId?.(Boolean(fileObj))
  }

  function updateAddressProofFile(fileObj) {
    if (currentAddressProofFile?.previewUrl && currentAddressProofFile.previewUrl !== fileObj?.previewUrl) {
      revokeFilePreviewUrl(currentAddressProofFile)
    }
    if (propSetAddressProofFile) {
      propSetAddressProofFile(fileObj)
    } else {
      setLocalAddressProofFile(fileObj)
    }
    setHasUploadedAddressProof?.(Boolean(fileObj))
  }

  function processFileSelection(file, updateTarget, setErrorState) {
    if (!file) return
    const validation = validateFile(file)
    if (!validation.valid) {
      setErrorState(validation.error)
      return
    }
    try {
      const previewUrl = createFilePreviewUrl(file)
      setErrorState(null)
      updateTarget({
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        previewUrl,
        file,
      })
    } catch (err) {
      setErrorState(err.message || 'Could not prepare selected document.')
    }
  }

  const documentSlots = [
    {
      key: 'nationalId',
      title: 'Citizen ID / National ID (CCCD)',
      subtitle: 'Subscriber or authorized holder CCCD / National Identity Card',
      icon: CreditCard,
      file: currentNationalIdFile,
      error: nationalIdError,
      isDragging: isDraggingNationalId,
      inputRef: nationalIdInputRef,
      onSelectFile: (file) => processFileSelection(file, updateNationalIdFile, setNationalIdError),
      onRemoveFile: () => {
        updateNationalIdFile(null)
        setNationalIdError(null)
        if (nationalIdInputRef.current) nationalIdInputRef.current.value = ''
      },
      onDragChange: setIsDraggingNationalId,
    },
    {
      key: 'addressProof',
      title: 'Proof of Installation Address',
      subtitle: 'Utility bill, lease contract, or residence / premise address confirmation',
      icon: MapPin,
      file: currentAddressProofFile,
      error: addressProofError,
      isDragging: isDraggingAddressProof,
      inputRef: addressProofInputRef,
      onSelectFile: (file) => processFileSelection(file, updateAddressProofFile, setAddressProofError),
      onRemoveFile: () => {
        updateAddressProofFile(null)
        setAddressProofError(null)
        if (addressProofInputRef.current) addressProofInputRef.current.value = ''
      },
      onDragChange: setIsDraggingAddressProof,
    },
  ]

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="border-b border-slate-100 pb-3">
        <h3 className="text-base font-bold text-slate-900">Subscriber Verification &amp; Feasibility Check</h3>
        <p className="text-xs text-slate-500">
          Upload Citizen ID (CCCD) and installation address verification documents (PDF, JPG, PNG &le; 10MB) and test ODN feasibility
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {documentSlots.map((slot) => (
          <DocumentUploadCard key={slot.key} {...slot} />
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-800">Pre-Survey ODN Cable Route Feasibility</span>
          <button
            type="button"
            onClick={handleRunODNCheck}
            disabled={isCheckingODN}
            className="rounded-lg bg-navy px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition cursor-pointer shadow-xs"
          >
            {isCheckingODN ? 'Probing ODN...' : 'Test Route Feasibility'}
          </button>
        </div>
        {odnCheckResult?.checked ? (
          <div className="mt-2 text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 flex items-center gap-2">
            <CheckCircle2 size={15} />
            <span>
              Route: <strong>{odnCheckResult.cableRoute}</strong> &bull; Distance: ~{odnCheckResult.distanceMeters}m &bull; Available Ports: {odnCheckResult.availablePonPorts}
            </span>
          </div>
        ) : (
          <p className="text-[11px] text-slate-500">Click to run automated GIS check against the nearest optical distribution frame.</p>
        )}
      </div>

      <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/40 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-indigo-100 p-1.5 text-indigo-700">
              <Banknote size={16} />
            </div>
            <div>
              <h4 className="text-xs font-black text-navy uppercase tracking-wider">
                Security Deposit Collection &amp; Receipt (CN16)
              </h4>
              <p className="text-[11px] text-slate-500">
                Confirm upfront deposit collection, payment channel, and issue deposit receipt before survey dispatch (100% refundable if ODN fails).
              </p>
            </div>
          </div>
          {generatedOrderId && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-white border border-indigo-200 px-2.5 py-1 font-mono text-[11px] font-bold text-indigo-700">
              <Receipt size={12} />
              {buildDepositReceiptNumber(
                generatedOrderId,
                Number(financialCalculations?.netDepositAndAdvance ?? 0) <= 0
              )}
            </span>
          )}
        </div>

        {financialCalculations && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div className="rounded-lg bg-white border border-slate-200 px-2.5 py-1.5">
              <span className="text-slate-400 block">Gross Deposit</span>
              <span className="font-mono font-bold text-slate-800">
                ${Number(financialCalculations.depositAmount || 0).toFixed(2)}
              </span>
            </div>
            <div className="rounded-lg bg-white border border-slate-200 px-2.5 py-1.5">
              <span className="text-slate-400 block">Advance Prepay</span>
              <span className="font-mono font-bold text-slate-800">
                ${Number(financialCalculations.advancePaymentAmount || 0).toFixed(2)}
              </span>
            </div>
            <div className="rounded-lg bg-white border border-slate-200 px-2.5 py-1.5">
              <span className="text-slate-400 block">Bulk Waiver</span>
              <span className="font-mono font-bold text-emerald-700">
                -${Number(financialCalculations.bulkDiscountAmount || 0).toFixed(2)}
              </span>
            </div>
            <div className="rounded-lg bg-navy text-white px-2.5 py-1.5">
              <span className="text-indigo-200 block">Net Deposit Due</span>
              <span className="font-mono font-black">
                ${Number(financialCalculations.netDepositAndAdvance || 0).toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {Number(financialCalculations?.netDepositAndAdvance ?? 0) <= 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
            <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
            <span>
              100% Bulk Scheme Deposit Waiver applied — Net deposit due is $0.00 (Waiver Receipt auto-issued).
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <span className="block text-[11px] font-bold text-slate-700 mb-1.5">
                Deposit Collection Method <span className="text-rose-500">*</span>
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {DEPOSIT_COLLECTION_METHODS.map((method) => {
                  const isActive = depositMethod === method.id
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setDepositMethod?.(method.id)}
                      className={`text-left rounded-xl border px-3 py-2 text-xs font-bold transition cursor-pointer ${
                        isActive
                          ? 'border-indigo-500 bg-white text-navy ring-2 ring-indigo-500/15'
                          : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-white'
                      }`}
                    >
                      {method.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Payment Ref / Slip / Auth Code
                </label>
                <input
                  type="text"
                  value={depositReference}
                  onChange={(e) => setDepositReference?.(e.target.value)}
                  placeholder="e.g. VQR-2026-0891 or POS-4410"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Collected By / Retail Counter
                </label>
                <input
                  type="text"
                  value={depositCollector}
                  onChange={(e) => setDepositCollector?.(e.target.value)}
                  placeholder="e.g. Hanoi Flagship Cashier"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <label className="flex items-start gap-2.5 rounded-xl border border-indigo-200 bg-white p-3 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(depositConfirmed)}
                onChange={(e) => setDepositConfirmed?.(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                I confirm collecting{' '}
                <span className="font-mono font-black text-navy">
                  ${Number(financialCalculations?.netDepositAndAdvance || 0).toFixed(2)}
                </span>{' '}
                via{' '}
                <span className="font-bold text-indigo-700">
                  {resolveDepositCollectionMethodLabel(depositMethod)}
                </span>{' '}
                and issuing deposit receipt{' '}
                <span className="font-mono font-bold text-indigo-700">
                  {buildDepositReceiptNumber(generatedOrderId || 'ORDER', false)}
                </span>{' '}
                (required for survey submission; Drafts may defer payment).
              </span>
            </label>
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 pt-2">
        <input
          type="checkbox"
          checked={agreedToTerms}
          onChange={(e) => setAgreedToTerms(e.target.checked)}
          className="rounded border-slate-300 text-brand-soft focus:ring-brand-soft"
        />
        <span>I confirm the subscriber CCCD and address verification documents and agree to Nexus Telecom Terms of Service.</span>
      </label>
    </div>
  )
}
