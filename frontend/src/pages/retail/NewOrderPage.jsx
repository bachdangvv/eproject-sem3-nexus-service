import { useState, useMemo, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Radio,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  Printer,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react'
import RetailLayout from '../../components/layout/RetailLayout'
import CustomerInfoStep from './components/CustomerInfoStep'
import ServicePlanStep from './components/ServicePlanStep'
import BulkSchemeStep from './components/BulkSchemeStep'
import DocumentStep from './components/DocumentStep'
import OrderSummary from './components/OrderSummary'
import {
  getNextOrderId,
  commitOrderWithDocuments,
  calculateOrderFinancials,
  isDialupConnectionType,
  validateDialupLandlineRequirement,
  DEPOSIT_WAIVER_METHOD,
  buildDepositReceiptNumber,
  getOrderDepositSummary,
  resolveDepositCollectionMethodLabel,
} from '../../services/orderService'
import PrintReceiptModal from '../../components/common/PrintReceiptModal'
import { getActivatedAccounts } from '../../services/activationService'
import { fetchCustomers } from '../../services/customerService'
import { fetchPlans, subscribePlansUpdated } from '../../services/planService'
import { getTierInfo } from '../../services/bulkScheme'
import { copyToClipboard } from '../../utils/clipboard'
import { ORDER_STATUS } from '../../utils/orderStatus'
import OrderStatusBadge from '../../components/common/OrderStatusBadge'
import { useAsyncResource } from '../../hooks/useAsyncResource'
import {
  REVIEW1_API_MODE,
  fetchCitiesApi,
  fetchCustomersApi,
  fetchPlansApi,
  createCustomerApi,
  fetchRequestsApi,
  createRequestApi,
  confirmRequestApi,
} from '../../services/review1Api'

const CITIES = [
  { code: '101', name: 'Hanoi', short: 'HN', prefix: '101' },
  { code: '201', name: 'Ho Chi Minh City', short: 'HCM', prefix: '201' },
  { code: '301', name: 'Da Nang', short: 'DN', prefix: '301' },
]

const CONNECTION_TYPES = [
  {
    id: 'BROADBAND',
    prefix: 'B',
    name: 'Broadband FTTx',
    badge: 'Recommended',
    badgeColor: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    description: 'High-speed GPON optical fiber designed for enterprise workloads.',
  },
  {
    id: 'DIALUP',
    prefix: 'D',
    name: 'Leased Line / Dial-up',
    badge: 'High Security',
    badgeColor: 'bg-amber-50 text-amber-700 ring-amber-200',
    description: 'Symmetric dedicated leased circuit or secure transaction dial-up.',
  },
  {
    id: 'LANDLINE',
    prefix: 'T',
    name: 'Telephone / SIP',
    badge: 'VoIP Trunk',
    badgeColor: 'bg-sky-50 text-sky-700 ring-sky-200',
    description: 'High-density IP PBX / SIP voice trunking for corporate switchboards.',
  },
]

const PAYMENT_SCHEMES = [
  { id: 'STANDARD_MONTHLY', title: 'Monthly Standard', monthsPrepaid: 0, months: 0, desc: 'Pay per billing cycle without advance lock-in.' },
  { id: 'ADVANCE_6M', title: 'Advance 6 Months', monthsPrepaid: 6, months: 6, desc: 'Prepay 6 months to lock in service stability.' },
  { id: 'ADVANCE_12M', title: 'Advance 12 Months', monthsPrepaid: 12, months: 12, desc: 'Prepay 12 months with highest enterprise priority.' },
]

export default function NewOrderPage() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)

  const localRegisteredCustomers = useMemo(
    () => fetchCustomers().filter((c) => c.status === 'ACTIVE'),
    []
  )
  const { data: apiCustomers } = useAsyncResource(
    () => (REVIEW1_API_MODE ? fetchCustomersApi() : Promise.resolve(localRegisteredCustomers)),
    [localRegisteredCustomers]
  )
  const registeredCustomers = REVIEW1_API_MODE ? (apiCustomers || []) : localRegisteredCustomers
  const { data: apiCities } = useAsyncResource(
    () => (REVIEW1_API_MODE ? fetchCitiesApi() : Promise.resolve(null)),
    []
  )
  const cities = useMemo(() => {
    if (!REVIEW1_API_MODE || !Array.isArray(apiCities) || apiCities.length === 0) return CITIES
    return apiCities.map((city) => ({
      code: city.code,
      name: city.name,
      short: String(city.code).slice(-2),
      prefix: city.code,
    }))
  }, [apiCities])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [taxId, setTaxId] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [installationAddress, setInstallationAddress] = useState('')
  const [representativeName, setRepresentativeName] = useState('')
  const [selectedCity, setSelectedCity] = useState(CITIES[0])
  const [customerErrors, setCustomerErrors] = useState({})

  useEffect(() => {
    if (cities.length > 0 && !cities.some((city) => city.code === selectedCity.code)) {
      setSelectedCity(cities[0])
    }
  }, [cities, selectedCity.code])

  const [catalogPlans, setCatalogPlans] = useState([])
  const { data: apiPlans } = useAsyncResource(
    () => (REVIEW1_API_MODE ? fetchPlansApi() : Promise.resolve(fetchPlans({ activeOnly: true }))),
    []
  )
  const {
    data: pendingRequestsData,
    reload: reloadPendingRequests,
  } = useAsyncResource(
    () => (REVIEW1_API_MODE ? fetchRequestsApi() : Promise.resolve([])),
    []
  )
  const pendingRequests = pendingRequestsData || []
  const [selectedConnectionType, setSelectedConnectionType] = useState('BROADBAND')
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [includePoESwitch, setIncludePoESwitch] = useState(false)
  const [hasLandlineBundle, setHasLandlineBundle] = useState(false)
  const [landlineOption, setLandlineOption] = useState('NONE')
  const [existingLandlineNumber, setExistingLandlineNumber] = useState('')
  const [step2LandlineTouched, setStep2LandlineTouched] = useState(false)

  const activeLandlineAccounts = useMemo(() => {
    const accounts = getActivatedAccounts().filter(
      (acc) =>
        String(acc.serviceType || '').toUpperCase() === 'LANDLINE' &&
        String(acc.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
    )
    const normalizedTax = taxId.trim()
    const normalizedName = customerName.trim().toLowerCase()
    return [...accounts]
      .map((acc) => ({
        ...acc,
        isCustomerMatch:
          (normalizedTax && acc.taxId === normalizedTax) ||
          (normalizedName &&
            String(acc.customerName || '').trim().toLowerCase() === normalizedName),
      }))
      .sort((a, b) => Number(b.isCustomerMatch) - Number(a.isCustomerMatch))
  }, [taxId, customerName])

  const [endpoints, setEndpoints] = useState(1)
  const [selectedPaymentScheme, setSelectedPaymentScheme] = useState('STANDARD_MONTHLY')

  const [nationalIdFile, setNationalIdFile] = useState(null)
  const [addressProofFile, setAddressProofFile] = useState(null)
  const [hasUploadedNationalId, setHasUploadedNationalId] = useState(false)
  const [hasUploadedAddressProof, setHasUploadedAddressProof] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(REVIEW1_API_MODE)
  const [odnCheckResult, setOdnCheckResult] = useState(null)
  const [isCheckingODN, setIsCheckingODN] = useState(false)
  const [depositMethod, setDepositMethod] = useState('CASH')
  const [depositConfirmed, setDepositConfirmed] = useState(false)
  const [depositReference, setDepositReference] = useState('')
  const [depositCollector, setDepositCollector] = useState('Store Cashier (Demo)')

  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)
  const [printingReceiptData, setPrintingReceiptData] = useState(null)
  const [copiedOrderId, setCopiedOrderId] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [requestSavedNotice, setRequestSavedNotice] = useState('')
  const odnTimerRef = useRef(null)
  const copyTimerRef = useRef(null)
  const latestFilesRef = useRef({ nationalIdFile: null, addressProofFile: null })

  useEffect(() => {
    latestFilesRef.current = { nationalIdFile, addressProofFile }
  }, [nationalIdFile, addressProofFile])

  useEffect(() => {
    return () => {
      if (odnTimerRef.current) clearTimeout(odnTimerRef.current)
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        if (latestFilesRef.current.nationalIdFile?.previewUrl) {
          URL.revokeObjectURL(latestFilesRef.current.nationalIdFile.previewUrl)
        }
        if (latestFilesRef.current.addressProofFile?.previewUrl) {
          URL.revokeObjectURL(latestFilesRef.current.addressProofFile.previewUrl)
        }
      }
    }
  }, [])

  useEffect(() => {
    if (REVIEW1_API_MODE) {
      setCatalogPlans(apiPlans || [])
      return undefined
    }
    const refreshPlans = () => setCatalogPlans(fetchPlans({ activeOnly: true }))
    refreshPlans()
    return subscribePlansUpdated(refreshPlans)
  }, [apiPlans])

  const currentPlans = useMemo(() => {
    return catalogPlans.filter((p) => p.connectionType === selectedConnectionType)
  }, [catalogPlans, selectedConnectionType])

  useEffect(() => {
    if (currentPlans.length === 0) {
      if (selectedPlanId !== '') setSelectedPlanId('')
      return
    }
    if (!currentPlans.some((p) => p.id === selectedPlanId)) {
      const defaultPlan = currentPlans.find((p) => p.recommended) || currentPlans[0]
      setSelectedPlanId(defaultPlan.id)
    }
  }, [currentPlans, selectedPlanId])

  const selectedPlan = useMemo(() => {
    return currentPlans.find((p) => p.id === selectedPlanId) || currentPlans[0] || null
  }, [currentPlans, selectedPlanId])

  const activeConnectionTypeObj =
    CONNECTION_TYPES.find((c) => c.id === selectedConnectionType) || CONNECTION_TYPES[0]

  const [createdOrder, setCreatedOrder] = useState(null)
  const [orderRefreshKey, setOrderRefreshKey] = useState(0)

  const generatedOrderId = useMemo(() => {
    return getNextOrderId(activeConnectionTypeObj.prefix)
  }, [activeConnectionTypeObj.prefix, orderRefreshKey])

  const bulkDiscountPercent = useMemo(() => {
    return getTierInfo(endpoints).percent
  }, [endpoints])

  const financialCalculations = useMemo(() => {
    const schemeObj = PAYMENT_SCHEMES.find((s) => s.id === selectedPaymentScheme) || PAYMENT_SCHEMES[0]
    const monthsPrepaid = schemeObj.monthsPrepaid !== undefined ? schemeObj.monthsPrepaid : (schemeObj.months || 0)

    return calculateOrderFinancials({
      planPriceUSD: selectedPlan ? selectedPlan.priceUSD : 0,
      endpoints,
      includePoESwitch,
      selectedConnectionType,
      hasLandlineBundle,
      monthsPrepaid,
      bulkDiscountPercent,
      installationFee: 50,
    })
  }, [selectedPlan, endpoints, includePoESwitch, selectedConnectionType, hasLandlineBundle, selectedPaymentScheme, bulkDiscountPercent])

  function handleConnectionTypeChange(typeId) {
    setSelectedConnectionType(typeId)
    const matchingPlans = catalogPlans.filter((p) => p.connectionType === typeId)
    const defaultPlan = matchingPlans.find((p) => p.recommended) || matchingPlans[0]
    setSelectedPlanId(defaultPlan ? defaultPlan.id : '')
    setHasLandlineBundle(false)
    setLandlineOption('NONE')
    setExistingLandlineNumber('')
    setStep2LandlineTouched(false)
  }

  function handleSelectLandlineOption(option) {
    setStep2LandlineTouched(true)
    if (option === 'BUNDLE') {
      setLandlineOption('BUNDLE')
      setHasLandlineBundle(true)
      return
    }
    if (option === 'EXISTING') {
      setLandlineOption('EXISTING')
      setHasLandlineBundle(false)
      return
    }
    setLandlineOption('NONE')
    setHasLandlineBundle(false)
  }

  function handleExistingLandlineChange(value) {
    setStep2LandlineTouched(true)
    setLandlineOption('EXISTING')
    setHasLandlineBundle(false)
    setExistingLandlineNumber(value)
  }

  function handleRunODNCheck() {
    setIsCheckingODN(true)
    if (odnTimerRef.current) clearTimeout(odnTimerRef.current)
    odnTimerRef.current = setTimeout(() => {
      setIsCheckingODN(false)
      setOdnCheckResult({
        checked: true,
        cableRoute: `ODN-${selectedCity.short}-08`,
        distanceMeters: Math.floor(Math.random() * 40) + 45,
        availablePonPorts: '4/8',
      })
    }, 800)
  }

  async function handleCopyOrderId() {
    await copyToClipboard(generatedOrderId)
    setCopiedOrderId(true)
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    copyTimerRef.current = setTimeout(() => setCopiedOrderId(false), 2000)
  }

  function handleSelectCustomer(customerId) {
    setSelectedCustomerId(customerId)
    setCustomerErrors({})
    if (!customerId) return
    const customer = registeredCustomers.find((c) => c.id === customerId)
    if (!customer) return
    setCustomerName(customer.customerName || '')
    setTaxId(customer.taxId || '')
    setCustomerEmail(customer.email || '')
    setCustomerPhone(customer.phone || '')
    setInstallationAddress(customer.address || '')
    setRepresentativeName(customer.contactPerson || '')
    const matchedCity = cities.find((c) => c.code === customer.branchCode)
    if (matchedCity) setSelectedCity(matchedCity)
  }

  function validateStep1() {
    const errors = {}
    if (!customerName.trim() || customerName.trim().length < 2) errors.customerName = 'Subscriber legal name is required.'
    if (REVIEW1_API_MODE) {
      const digits = customerPhone.replace(/[^\d]/g, '')
      if (digits.length < 7 || digits.length > 15) errors.customerPhone = 'Valid phone (7-15 digits) is required.'
      if (customerEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) {
        errors.customerEmail = 'Invalid email format.'
      }
    } else {
      if (!taxId.trim() || taxId.trim().length < 5) errors.taxId = 'Valid Tax ID (min 5 chars) is required.'
      if (!representativeName.trim() || representativeName.trim().length < 2) errors.representativeName = 'Authorized representative name is required.'
      if (!customerPhone.trim() || customerPhone.trim().length < 8) errors.customerPhone = 'Valid contact phone is required.'
      if (!customerEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) errors.customerEmail = 'Valid billing email is required.'
    }
    if (!installationAddress.trim() || installationAddress.trim().length < 5) errors.installationAddress = 'Installation site address is required.'
    return errors
  }

  const isStep1Complete = useMemo(() => Object.keys(validateStep1()).length === 0, [
    customerName,
    taxId,
    representativeName,
    customerPhone,
    customerEmail,
    installationAddress,
  ])

  const hasDocuments = REVIEW1_API_MODE || Boolean(
    nationalIdFile &&
    addressProofFile &&
    hasUploadedNationalId &&
    hasUploadedAddressProof
  )
  const hasPlanSelected = Boolean(selectedPlan)
  const hasOdnCheck = REVIEW1_API_MODE || Boolean(odnCheckResult?.checked)
  const isDialupSelected = isDialupConnectionType(selectedConnectionType)
  const dialupLandlineValidation = useMemo(
    () =>
      validateDialupLandlineRequirement({
        serviceType: selectedConnectionType,
        hasLandlineBundle,
        landlineOption,
        existingLandlineNumber,
      }),
    [selectedConnectionType, hasLandlineBundle, landlineOption, existingLandlineNumber]
  )
  const hasDialupLandlineRequirement = REVIEW1_API_MODE || !isDialupSelected || dialupLandlineValidation.valid
  const netDepositDue = REVIEW1_API_MODE ? 0 : Number(financialCalculations.netDepositAndAdvance || 0)
  const isDepositWaived = REVIEW1_API_MODE || netDepositDue <= 0
  const hasDepositCollection = REVIEW1_API_MODE || isDepositWaived || (Boolean(depositConfirmed) && Boolean(depositMethod))

  useEffect(() => {
    setDepositConfirmed(false)
  }, [netDepositDue])

  const canSaveDraft = Boolean(customerName.trim())
  const canSubmit = Boolean(
    isStep1Complete &&
    hasPlanSelected &&
    hasDialupLandlineRequirement &&
    hasDocuments &&
    hasOdnCheck &&
    hasDepositCollection &&
    agreedToTerms
  )

  const validationChecklist = REVIEW1_API_MODE
    ? [
        { id: 'customer', label: 'Subscriber Identification & Address', done: isStep1Complete, stepNum: 1 },
        { id: 'plan', label: 'Active Tariff Plan Selected (Admin Catalog)', done: hasPlanSelected, stepNum: 2 },
        ...(isDialupSelected
          ? [
              {
                id: 'dialup-landline',
                label: hasLandlineBundle
                  ? 'Dial-Up Landline: Customer has Nexus landline'
                  : 'Dial-Up Landline: Technical Survey will verify feasibility',
                done: true,
                stepNum: 2,
              },
            ]
          : []),
        { id: 'terms', label: 'Order Confirmation Checkbox Checked', done: Boolean(agreedToTerms), stepNum: 4 },
      ]
    : [
        { id: 'customer', label: 'Subscriber Identification & Address', done: isStep1Complete, stepNum: 1 },
        { id: 'plan', label: 'Active Tariff Plan Selected (Admin Catalog)', done: hasPlanSelected, stepNum: 2 },
        ...(isDialupSelected
          ? [
              {
                id: 'dialup-landline',
                label: dialupLandlineValidation.valid
                  ? dialupLandlineValidation.mode === 'BUNDLE'
                    ? 'Dial-Up Landline: New PSTN Bundle (+$15/mo)'
                    : `Dial-Up Landline: Linked ${dialupLandlineValidation.existingLandlineNumber}`
                  : 'Dial-Up Prerequisite: Link Existing Landline or +$15/mo Bundle',
                done: dialupLandlineValidation.valid,
                stepNum: 2,
              },
            ]
          : []),
        { id: 'documents', label: 'CCCD & Address Verification Uploaded (2/2)', done: hasDocuments, stepNum: 4 },
        { id: 'odn', label: 'ODN Route Feasibility Checked', done: hasOdnCheck, stepNum: 4 },
        {
          id: 'deposit',
          label: isDepositWaived
            ? 'Security Deposit Waived ($0.00 • 100% Bulk)'
            : hasDepositCollection
            ? `Deposit Confirmed ($${netDepositDue.toFixed(2)} • ${resolveDepositCollectionMethodLabel(depositMethod)})`
            : `Collect Deposit ($${netDepositDue.toFixed(2)}) & Receipt (CN16)`,
          done: hasDepositCollection,
          stepNum: 4,
        },
        { id: 'terms', label: 'Terms of Service Agreed', done: Boolean(agreedToTerms), stepNum: 4 },
      ]

  function handleNextStep() {
    if (currentStep === 1) {
      const errors = validateStep1()
      setCustomerErrors(errors)
      if (Object.keys(errors).length > 0) return
    }
    if (!REVIEW1_API_MODE && currentStep === 2 && isDialupSelected && !dialupLandlineValidation.valid) {
      setStep2LandlineTouched(true)
      return
    }
    setCurrentStep((prev) => Math.min(4, prev + 1))
  }

  async function submitOrderWithStatus(status) {
    if (isSubmitting) return
    if (status === ORDER_STATUS.DRAFT && !canSaveDraft) return
    if (status !== ORDER_STATUS.DRAFT && !canSubmit) return

    setIsSubmitting(true)
    setSubmitError('')

    try {
      const hasAttachedDocuments = Boolean(nationalIdFile || addressProofFile)
      const committed = await commitOrderWithDocuments({
        id: generatedOrderId,
        customerId: selectedCustomerId || null,
        serviceType: selectedConnectionType,
        serviceName: activeConnectionTypeObj.name,
        customerName: customerName.trim(),
        taxId: taxId.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.trim(),
        phone: customerPhone.trim(),
        address: installationAddress.trim(),
        representativeName: representativeName.trim(),
        contactPerson: representativeName.trim(),
        branchCode: selectedCity.code,
        branchName: `${selectedCity.name} (${selectedCity.short})`,
        planId: selectedPlan?.id || '',
        planSku: selectedPlan?.sku || selectedPlan?.id || '',
        planName: selectedPlan ? selectedPlan.name : 'Unassigned Draft Plan',
        planPriceUSD: selectedPlan ? selectedPlan.priceUSD : 0,
        endpoints,
        bulkDiscountPercent,
        hasLandlineBundle: REVIEW1_API_MODE
          ? (isDialupSelected && Boolean(hasLandlineBundle))
          : (isDialupSelected ? dialupLandlineValidation.hasLandlineBundle : false),
        landlineOption: dialupLandlineValidation.mode,
        existingLandlineNumber: dialupLandlineValidation.existingLandlineNumber,
        paymentScheme: selectedPaymentScheme,
        depositAmountUSD: financialCalculations.depositAmount,
        advancePaymentUSD: financialCalculations.advancePaymentAmount,
        bulkDiscountAmountUSD: financialCalculations.bulkDiscountAmount,
        refundableAmountUSD: financialCalculations.netDepositAndAdvance,
        grandTotalUSD: financialCalculations.grandTotal,
        requireDepositConfirmation: status !== ORDER_STATUS.DRAFT,
        depositCollected: status === ORDER_STATUS.DRAFT ? Boolean(depositConfirmed || isDepositWaived) : true,
        depositPaymentMethod: isDepositWaived
          ? DEPOSIT_WAIVER_METHOD.id
          : status !== ORDER_STATUS.DRAFT || depositConfirmed
          ? depositMethod
          : '',
        depositCollectedAmountUSD:
          status !== ORDER_STATUS.DRAFT || depositConfirmed ? netDepositDue : 0,
        depositReceiptNumber:
          status !== ORDER_STATUS.DRAFT || depositConfirmed || isDepositWaived
            ? buildDepositReceiptNumber(generatedOrderId, isDepositWaived)
            : '',
        depositReference: depositReference.trim(),
        depositCollector: depositCollector.trim() || 'Store Cashier (Demo)',
        odnCheckResult,
        agreedToTerms: Boolean(agreedToTerms),
        ...(hasAttachedDocuments
          ? {
              documents: {
                nationalId: nationalIdFile,
                addressProof: addressProofFile,
              },
            }
          : {}),
        status,
      })
      setCreatedOrder(committed)
      setIsSuccessModalOpen(true)
      setOrderRefreshKey((prev) => prev + 1)
    } catch (err) {
      setSubmitError(
        err?.message || 'Unable to save attached verification documents or register the order.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleFinalSubmit() {
    submitOrderWithStatus(ORDER_STATUS.PENDING_SURVEY)
  }

  function handleSaveDraft() {
    submitOrderWithStatus(ORDER_STATUS.DRAFT)
  }

  async function handleSaveRequestOnly() {
    if (isSubmitting || !canSubmit) return
    setIsSubmitting(true)
    setSubmitError('')
    try {
      let customerId = Number(selectedCustomerId)
      if (!Number.isInteger(customerId) || customerId <= 0) {
        const createdCustomer = await createCustomerApi({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          installationAddress: installationAddress.trim(),
          branchCode: selectedCity.code,
          taxId: taxId.trim(),
          customerEmail: customerEmail.trim(),
          representativeName: representativeName.trim(),
        })
        customerId = Number(createdCustomer.backendId)
        setSelectedCustomerId(createdCustomer.id)
      }
      const savedReq = await createRequestApi({
        customerId,
        planId: Number(selectedPlan?.backendId || selectedPlan?.id),
        hasNexusLandline: isDialupSelected && Boolean(hasLandlineBundle),
      })
      setRequestSavedNotice(
        `Request #${savedReq.id} saved for ${savedReq.customerName || customerName.trim()}. Click "Confirm Request #${savedReq.id}" below to generate its 11-char Order ID.`
      )
      reloadPendingRequests()
    } catch (err) {
      setSubmitError(err?.message || 'Unable to save service request.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleConfirmPendingRequest(requestId) {
    if (isSubmitting) return
    setIsSubmitting(true)
    setSubmitError('')
    try {
      const confirmed = await confirmRequestApi(requestId)
      setCreatedOrder(confirmed)
      setIsSuccessModalOpen(true)
      reloadPendingRequests()
      setOrderRefreshKey((prev) => prev + 1)
    } catch (err) {
      setSubmitError(err?.message || 'Unable to confirm request into order.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <RetailLayout activeNavId="new-order" apiMode={REVIEW1_API_MODE}>
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600 border border-emerald-200">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {createdOrder?.status === ORDER_STATUS.DRAFT
                      ? 'Order Saved as Draft!'
                      : 'Order Registered Successfully!'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {createdOrder?.status === ORDER_STATUS.DRAFT
                      ? 'Saved as Draft — finish details before dispatching to ODN survey'
                      : 'Dispatched to Technical ODN Survey Queue'}
                  </p>
                </div>
              </div>
              {createdOrder?.status && <OrderStatusBadge status={createdOrder.status} />}
            </div>

            <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 text-center space-y-2.5">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider mb-0.5">Generated Order ID (11-Char)</span>
                <span className="font-mono text-xl font-black text-indigo-600">
                  {createdOrder ? createdOrder.id : generatedOrderId}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200/70">
                <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider mb-1">16-Character Account ID</span>
                <span className="font-mono text-xs font-semibold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200 inline-block shadow-xs">
                  {REVIEW1_API_MODE
                    ? 'Issued upon Technical Activation'
                    : `Account ID will be issued upon Technical Activation (e.g. ${createdOrder?.servicePrefix || 'B'}101000000000001)`}
                </span>
              </div>
              {REVIEW1_API_MODE && createdOrder && (
                <div className="pt-2 border-t border-slate-200/70 flex justify-between text-xs text-slate-600">
                  <span>Billable Plan Fee:</span>
                  <span className="font-mono font-bold text-indigo-700">
                    ${Number(createdOrder.planPriceUSD || 0).toFixed(2)} USD
                  </span>
                </div>
              )}
              {(createdOrder?.documents?.nationalId || createdOrder?.documents?.addressProof) && (
                <div className="pt-2 border-t border-slate-200/70 text-[11px] font-semibold text-emerald-700">
                  Verification files persisted in browser IndexedDB storage for inspection &amp; download.
                </div>
              )}
              {!REVIEW1_API_MODE && createdOrder && (() => {
                const depSummary = getOrderDepositSummary(createdOrder)
                return (
                  <div className="pt-2 border-t border-slate-200/70 text-left rounded-lg bg-white p-2.5 border border-slate-200 space-y-1 text-[11px]">
                    <div className="flex items-center justify-between font-bold text-navy">
                      <span>CN16 Deposit Status</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] ${
                          depSummary.isCollectedOrWaived
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {depSummary.statusLabel}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Method:</span>
                      <span className="font-semibold text-slate-800">{depSummary.methodLabel}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Collected / Waived:</span>
                      <span className="font-mono font-bold text-slate-900">
                        ${depSummary.collectedAmountUSD.toFixed(2)}
                      </span>
                    </div>
                    {depSummary.receiptNumber && (
                      <div className="flex justify-between text-slate-600">
                        <span>Receipt No.:</span>
                        <span className="font-mono font-bold text-indigo-700">{depSummary.receiptNumber}</span>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            <div className="flex flex-wrap gap-2">
              {!REVIEW1_API_MODE && createdOrder && getOrderDepositSummary(createdOrder).isCollectedOrWaived && (
                <button
                  type="button"
                  onClick={() => {
                    const dep = getOrderDepositSummary(createdOrder)
                    setPrintingReceiptData({
                      receiptType: 'DEPOSIT',
                      depositStatus: dep.depositStatus,
                      receiptNumber: dep.receiptNumber,
                      customerName: createdOrder.customerName,
                      taxId: createdOrder.taxId,
                      branchName: createdOrder.branchName,
                      accountId: createdOrder.accountId || 'Issued upon commissioning',
                      orderId: createdOrder.id,
                      serviceTitle: createdOrder.planName,
                      grossDepositUSD: dep.grossDepositUSD,
                      advancePaymentUSD: dep.advancePaymentUSD,
                      bulkDiscountUSD: dep.bulkDiscountUSD,
                      amount: dep.collectedAmountUSD,
                      paymentMethod: dep.methodLabel,
                      referenceCode: dep.referenceCode,
                      collectorName: dep.collectorName,
                    })
                  }}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 py-2.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
                >
                  <Printer size={14} />
                  <span>Print Deposit Receipt ({getOrderDepositSummary(createdOrder).receiptNumber})</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate('/retail/orders')}
                className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition cursor-pointer text-center"
              >
                View in Orders List
              </button>
              <button
                type="button"
                onClick={() => navigate('/technical/surveys')}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer text-center"
              >
                Dispatch to Survey
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card p-5 md:p-6 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <span>Retail Operations</span>
              <span>/</span>
              <span className="font-semibold text-slate-700">Order Management</span>
              <span>/</span>
              <span className="font-mono text-brand-soft">New Subscription</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl md:text-2xl font-extrabold text-navy">
                New Enterprise Subscription Provisioning
              </h1>
              <span className="rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 font-mono text-[11px] font-bold text-brand-soft">
                {REVIEW1_API_MODE ? 'Review 1 Request' : generatedOrderId}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Configure customer billing profile, connection type, enterprise bandwidth tariff, and outside plant feasibility.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/retail/orders"
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              Back to Orders Portfolio
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-slate-100 pb-3">
          {[
            { num: 1, label: '1. Customer Info' },
            { num: 2, label: '2. Service & Tariff' },
            { num: 3, label: REVIEW1_API_MODE ? '3. Bulk Reference' : '3. Bulk Scheme' },
            { num: 4, label: REVIEW1_API_MODE ? '4. Review & Submit' : '4. Docs, ODN & Deposit' },
          ].map((step) => (
            <button
              key={step.num}
              type="button"
              onClick={() => setCurrentStep(step.num)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                currentStep === step.num
                  ? 'bg-navy text-white shadow-sm shadow-navy/20'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-navy border border-slate-200/60'
              }`}
            >
              <span>{step.label}</span>
            </button>
          ))}
        </div>
        {requestSavedNotice && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-center justify-between gap-3 text-xs text-emerald-900">
            <div className="flex items-center gap-2.5 font-semibold">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <span>{requestSavedNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setRequestSavedNotice('')}
              className="text-[11px] font-bold text-emerald-700 hover:underline shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
        {submitError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 flex items-start gap-3 text-xs text-rose-800">
            <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-rose-900">Order Submission Failed — Documents Not Saved</div>
              <p className="mt-0.5 leading-relaxed">{submitError}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-4">
            {currentStep === 1 && (
              <CustomerInfoStep
                customers={registeredCustomers}
                selectedCustomerId={selectedCustomerId}
                onSelectCustomer={handleSelectCustomer}
                customerName={customerName}
                setCustomerName={setCustomerName}
                taxId={taxId}
                setTaxId={setTaxId}
                customerEmail={customerEmail}
                setCustomerEmail={setCustomerEmail}
                customerPhone={customerPhone}
                setCustomerPhone={setCustomerPhone}
                installationAddress={installationAddress}
                setInstallationAddress={setInstallationAddress}
                representativeName={representativeName}
                setRepresentativeName={setRepresentativeName}
                selectedCity={selectedCity}
                setSelectedCity={setSelectedCity}
                cities={cities}
                errors={customerErrors}
              />
            )}

            {currentStep === 2 && (
              <ServicePlanStep
                connectionTypes={CONNECTION_TYPES}
                selectedConnectionType={selectedConnectionType}
                handleConnectionTypeChange={handleConnectionTypeChange}
                currentPlans={currentPlans}
                selectedPlanId={selectedPlanId}
                setSelectedPlanId={setSelectedPlanId}
                includePoESwitch={includePoESwitch}
                setIncludePoESwitch={setIncludePoESwitch}
                hasLandlineBundle={hasLandlineBundle}
                setHasLandlineBundle={setHasLandlineBundle}
                landlineOption={landlineOption}
                onSelectLandlineOption={handleSelectLandlineOption}
                existingLandlineNumber={existingLandlineNumber}
                onExistingLandlineChange={handleExistingLandlineChange}
                availableLandlineAccounts={activeLandlineAccounts}
                dialupLandlineValidation={dialupLandlineValidation}
                step2LandlineTouched={step2LandlineTouched}
              />
            )}

            {currentStep === 3 && (
              <BulkSchemeStep
                endpoints={endpoints}
                setEndpoints={setEndpoints}
                bulkDiscountPercent={bulkDiscountPercent}
                paymentSchemes={PAYMENT_SCHEMES}
                selectedPaymentScheme={selectedPaymentScheme}
                setSelectedPaymentScheme={setSelectedPaymentScheme}
                apiMode={REVIEW1_API_MODE}
              />
            )}

            {currentStep === 4 && (
              <DocumentStep
                nationalIdFile={nationalIdFile}
                setNationalIdFile={setNationalIdFile}
                addressProofFile={addressProofFile}
                setAddressProofFile={setAddressProofFile}
                hasUploadedNationalId={hasUploadedNationalId}
                setHasUploadedNationalId={setHasUploadedNationalId}
                hasUploadedAddressProof={hasUploadedAddressProof}
                setHasUploadedAddressProof={setHasUploadedAddressProof}
                agreedToTerms={agreedToTerms}
                setAgreedToTerms={setAgreedToTerms}
                odnCheckResult={odnCheckResult}
                handleRunODNCheck={handleRunODNCheck}
                isCheckingODN={isCheckingODN}
                generatedOrderId={generatedOrderId}
                financialCalculations={financialCalculations}
                depositMethod={depositMethod}
                setDepositMethod={setDepositMethod}
                depositConfirmed={depositConfirmed}
                setDepositConfirmed={setDepositConfirmed}
                depositReference={depositReference}
                setDepositReference={setDepositReference}
                depositCollector={depositCollector}
                setDepositCollector={setDepositCollector}
                apiMode={REVIEW1_API_MODE}
              />
            )}

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                disabled={currentStep === 1}
                onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
                className={`flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold ${
                  currentStep === 1 ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-white text-slate-700 hover:bg-slate-50 cursor-pointer'
                }`}
              >
                <ArrowLeft size={14} />
                <span>Previous Step</span>
              </button>

              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  <span>Continue to Step {currentStep + 1}</span>
                  <ArrowRight size={14} />
                </button>
              ) : null}
            </div>
          </div>

          <div className="lg:col-span-4">
            <OrderSummary
              financialCalculations={financialCalculations}
              generatedOrderId={REVIEW1_API_MODE ? 'Assigned on confirm' : generatedOrderId}
              bulkDiscountPercent={bulkDiscountPercent}
              handleFinalSubmit={handleFinalSubmit}
              handleSaveDraft={REVIEW1_API_MODE ? null : handleSaveDraft}
              handleSaveRequest={REVIEW1_API_MODE ? handleSaveRequestOnly : null}
              copiedOrderId={copiedOrderId}
              handleCopyOrderId={handleCopyOrderId}
              canSubmit={canSubmit}
              canSaveDraft={canSaveDraft}
              isSubmitting={isSubmitting}
              submitError={submitError}
              validationChecklist={validationChecklist}
              onChecklistStepClick={setCurrentStep}
              apiMode={REVIEW1_API_MODE}
              planPriceUSD={selectedPlan ? selectedPlan.priceUSD : 0}
            />
          </div>
        </div>

        {REVIEW1_API_MODE && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-extrabold text-navy">
                  Service Requests Awaiting Confirmation ({pendingRequests.length})
                </h2>
                <p className="text-[11px] text-slate-500">
                  Saved requests wait here until Retail confirms them into Pending Orders (`B...` / `D...` / `T...`).
                </p>
              </div>
              <button
                type="button"
                onClick={reloadPendingRequests}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Refresh Requests
              </button>
            </div>

            {pendingRequests.length === 0 ? (
              <p className="text-xs text-slate-500">
                No requests awaiting confirmation. Use &ldquo;Save Request (Awaiting Confirmation)&rdquo; or &ldquo;Create &amp; Provision Order&rdquo;.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="border-b border-slate-100 bg-slate-50/70 font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Request ID</th>
                      <th className="px-3 py-2">Customer</th>
                      <th className="px-3 py-2">Plan</th>
                      <th className="px-3 py-2">Price</th>
                      <th className="px-3 py-2">Address</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {pendingRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/60">
                        <td className="px-3 py-2.5 font-mono font-bold text-indigo-700">#{req.id}</td>
                        <td className="px-3 py-2.5 font-bold text-slate-900">{req.customerName}</td>
                        <td className="px-3 py-2.5">{req.planName}</td>
                        <td className="px-3 py-2.5 font-mono font-bold text-slate-800">${Number(req.price || 0).toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-slate-500">{req.address}</td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => handleConfirmPendingRequest(req.id)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-navy px-3 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 size={12} />
                            <span>Confirm Request #{req.id}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {printingReceiptData && (
        <PrintReceiptModal
          receiptData={printingReceiptData}
          onClose={() => setPrintingReceiptData(null)}
        />
      )}
    </RetailLayout>
  )
}
