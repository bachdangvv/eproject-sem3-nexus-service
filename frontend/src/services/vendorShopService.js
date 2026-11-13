const STORAGE_PREFIX_KEY = 'nexus_metro_prefixes_v1'
const STORAGE_STORE_KEY = 'nexus_retail_stores_v1'
const STORAGE_VENDOR_KEY = 'nexus_hardware_vendors_v1'
const STORAGE_DISPATCH_KEY = 'nexus_dispatch_logs_v1'

export const INITIAL_METRO_PREFIXES = [
  {
    cityCode: '101',
    cityName: 'Hanoi Metro Capital',
    region: 'North Core Hub',
    nocHub: 'NOC HN-01 (Ba Dinh Core)',
    activeSubscribers: 14720,
    storeCount: 28,
    status: 'READY',
  },
  {
    cityCode: '201',
    cityName: 'Ho Chi Minh Metro City',
    region: 'South Core Hub',
    nocHub: 'NOC SG-01 (Tan Binh Core)',
    activeSubscribers: 22480,
    storeCount: 36,
    status: 'READY',
  },
  {
    cityCode: '301',
    cityName: 'Da Nang Coastal Metro',
    region: 'Central Core Hub',
    nocHub: 'NOC DN-01 (Hai Chau Core)',
    activeSubscribers: 6230,
    storeCount: 12,
    status: 'READY',
  },
  {
    cityCode: '102',
    cityName: 'Hai Phong Port Metro',
    region: 'North Coastal Sub-hub',
    nocHub: 'Sub-NOC Le Chan',
    activeSubscribers: 3850,
    storeCount: 6,
    status: 'READY',
  },
  {
    cityCode: '202',
    cityName: 'Can Tho Mekong Metro',
    region: 'Mekong Delta Hub',
    nocHub: 'Sub-NOC Ninh Kieu',
    activeSubscribers: 3120,
    storeCount: 6,
    status: 'READY',
  },
]

export const INITIAL_RETAIL_STORES = [
  {
    storeCode: 'STORE-VN-101',
    storeName: 'Hoan Kiem Retail & Client Desk',
    cityCode: '101',
    cityName: 'Hanoi Capital',
    address: '45 Ly Thuong Kiet, Hoan Kiem, Hanoi',
    managerName: 'Tran Manh Hung',
    staffCount: 12,
    cpeStock: 82,
    cpeCapacity: 150,
    counterNumber: '04',
    recentOrderRef: '#B0000001089',
    status: 'ACTIVE',
  },
  {
    storeCode: 'STORE-VN-201',
    storeName: 'District 1 Financial Retail Center',
    cityCode: '201',
    cityName: 'Ho Chi Minh City',
    address: '120 Nguyen Hue, District 1, Ho Chi Minh City',
    managerName: 'Le Thuy Trang',
    staffCount: 16,
    cpeStock: 110,
    cpeCapacity: 180,
    counterNumber: '08',
    recentOrderRef: '#B0000001092',
    status: 'ACTIVE',
  },
  {
    storeCode: 'STORE-VN-301',
    storeName: 'Hai Chau Telecom Hub',
    cityCode: '301',
    cityName: 'Da Nang City',
    address: '78 Bach Dang, Hai Chau, Da Nang',
    managerName: 'Vo Quoc Huy',
    staffCount: 8,
    cpeStock: 45,
    cpeCapacity: 80,
    counterNumber: '02',
    recentOrderRef: '#T0000001093',
    status: 'ACTIVE',
  },
  {
    storeCode: 'STORE-VN-102',
    storeName: 'Cau Giay Tech Center Desk',
    cityCode: '101',
    cityName: 'Hanoi Capital',
    address: '10 Duy Tan, Cau Giay, Hanoi',
    managerName: 'Do Minh Tuan',
    staffCount: 15,
    cpeStock: 96,
    cpeCapacity: 150,
    counterNumber: '05',
    recentOrderRef: '#B0000001094',
    status: 'ACTIVE',
  },
]

export const INITIAL_HARDWARE_VENDORS = [
  {
    id: 'VEND-NOKIA',
    vendorName: 'Nokia Corporation',
    headquarters: 'Espoo, Finland (Vietnam Rep SLA Tier-1)',
    flagshipProduct: 'Nokia 10AM ONT G-140W-MD',
    standard: 'GPON Class B+ Standard',
    specs: '4x GbE, Dual-band Wi-Fi 6, 2x POTS VoIP, GPON SC/UPC',
    unitCostUSD: 48.5,
    monthlySupply: 10200,
    availableStock: 2140,
    defectRate: '< 0.08%',
    warranty: '24 Months Replacement',
    status: 'APPROVED',
  },
  {
    id: 'VEND-CISCO',
    vendorName: 'Cisco Systems Inc',
    headquarters: 'San Jose, USA (Global Gold Partner)',
    flagshipProduct: 'Cisco Catalyst PON 800 ME',
    standard: 'B2B Leased Line Carrier Grade',
    specs: '8x GbE, 2x 10G SFP+ Uplink, Hardware QoS SLA 99.99%',
    unitCostUSD: 240.0,
    monthlySupply: 4800,
    availableStock: 1280,
    defectRate: '< 0.01%',
    warranty: '36 Months On-site NOC',
    status: 'APPROVED',
  },
  {
    id: 'VEND-HUAWEI',
    vendorName: 'Huawei Technologies',
    headquarters: 'Shenzhen, China (GPON OLT Ecosystem)',
    flagshipProduct: 'OptiXstar EG8145V5',
    standard: 'Wi-Fi 5/6 Dual Gateway',
    specs: '4x GbE, 1x TEL, Wi-Fi 5 AC1200, Native OLT OMCI',
    unitCostUSD: 38.0,
    monthlySupply: 12000,
    availableStock: 950,
    defectRate: '< 0.15%',
    warranty: '24 Months Standard',
    status: 'APPROVED',
  },
  {
    id: 'VEND-GRANDSTREAM',
    vendorName: 'Grandstream Networks',
    headquarters: 'Boston, USA (VoIP & Unified PBX)',
    flagshipProduct: 'UCM6302 / HT814 Gateway',
    standard: 'Voice Gateway PRI Backbone',
    specs: '2x FXS ports, SIP RFC3261, G.711/G.729, Voice Priority',
    unitCostUSD: 110.0,
    monthlySupply: 3400,
    availableStock: 520,
    defectRate: '< 0.05%',
    warranty: '24 Months Enterprise',
    status: 'APPROVED',
  },
]

export const INITIAL_DISPATCH_LOGS = [
  {
    id: 'PO-2026-HN-001',
    status: 'IN_TRANSIT',
    title: '500 ONT Nokia G-140W-MD In-Transit',
    details: 'Dispatched from Hai Phong Port bonded warehouse to Hoan Kiem Retail Desk, Hanoi.',
    eta: 'ETA: Today 16:30 GMT+7',
  },
  {
    id: 'PO-2026-SG-012',
    status: 'DELIVERED',
    title: '120 Cisco Catalyst PON 800 Handed Over',
    details: 'Delivered to Tan Binh Leased Line NOC deployment team. Barcodes reconciled with ERP.',
    eta: 'Completed 10:15 GMT+7',
  },
  {
    id: 'ALERT-DN-301',
    status: 'WARNING',
    title: 'Stock Warning: Hai Chau Desk Low Inventory',
    details: 'Only 45 ONT units remaining (< 30% safety threshold). Auto-transfer PO triggered: 50 units from Da Nang central hub.',
    eta: 'Dispatch in Progress',
  },
]

export const VALID_STORE_STATUSES = ['ACTIVE', 'MAINTENANCE', 'INACTIVE']
export const VALID_VENDOR_STATUSES = ['APPROVED', 'PROBATION', 'SUSPENDED']

export function normalizeRetailStoreRecord(store = {}, prefixes = INITIAL_METRO_PREFIXES) {
  const cityCode = String(store.cityCode || '101').trim()
  const matchedPrefix = prefixes.find((p) => p.cityCode === cityCode)
  const storeCode = String(store.storeCode || store.code || '').trim().toUpperCase()
  const storeName = String(store.storeName || store.name || '').trim()
  const managerName = String(store.managerName || store.manager || '').trim()
  return {
    ...store,
    storeCode,
    storeName,
    cityCode,
    cityName: String(store.cityName || matchedPrefix?.cityName || 'Metro Hub').trim(),
    address: String(store.address || '').trim(),
    managerName,
    phone: String(store.phone || '+84 24 3900 1000').trim(),
    staffCount: Math.max(0, Number(store.staffCount ?? 6) || 0),
    cpeStock: Math.max(0, Number(store.cpeStock ?? 40) || 0),
    cpeCapacity: Math.max(1, Number(store.cpeCapacity ?? 100) || 100),
    counterNumber: String(store.counterNumber || '01').trim(),
    recentOrderRef: store.recentOrderRef || '—',
    type: String(store.type || 'Direct Store').trim(),
    status: VALID_STORE_STATUSES.includes(String(store.status || 'ACTIVE').toUpperCase())
      ? String(store.status || 'ACTIVE').toUpperCase()
      : 'ACTIVE',
  }
}

export function normalizeHardwareVendorRecord(vendor = {}) {
  const statusUpper = String(vendor.status || 'APPROVED').trim().toUpperCase()
  return {
    ...vendor,
    id: String(vendor.id || vendor.code || '').trim().toUpperCase(),
    vendorName: String(vendor.vendorName || vendor.name || '').trim(),
    headquarters: String(vendor.headquarters || 'Vietnam Partner Rep Office').trim(),
    flagshipProduct: String(vendor.flagshipProduct || vendor.category || '').trim(),
    standard: String(vendor.standard || 'Enterprise Telecom Standard').trim(),
    specs: String(vendor.specs || 'Carrier-grade CPE hardware').trim(),
    unitCostUSD: Math.max(0, Number(vendor.unitCostUSD ?? 0) || 0),
    monthlySupply: Math.max(0, Number(vendor.monthlySupply ?? 0) || 0),
    availableStock: Math.max(0, Number(vendor.availableStock ?? 0) || 0),
    defectRate: String(vendor.defectRate || '< 0.2%').trim(),
    warranty: String(vendor.warranty || '24 Months Replacement').trim(),
    status: VALID_VENDOR_STATUSES.includes(statusUpper) ? statusUpper : 'APPROVED',
  }
}

function getNextStoreCode(stores, cityCode) {
  const prefix = `STORE-VN-${cityCode}`
  const existingCodes = new Set(stores.map((s) => String(s.storeCode || '').toUpperCase()))
  if (!existingCodes.has(prefix)) return prefix
  let seq = 1
  while (existingCodes.has(`STORE-${cityCode}-${String(seq).padStart(3, '0')}`)) {
    seq += 1
  }
  return `STORE-${cityCode}-${String(seq).padStart(3, '0')}`
}

function getNextVendorId(vendors, vendorName) {
  const existingIds = new Set(vendors.map((v) => String(v.id || '').toUpperCase()))
  const slug = String(vendorName || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 10) || 'PARTNER'
  const baseId = `VEND-${slug}`
  if (!existingIds.has(baseId)) return baseId
  let seq = 2
  while (existingIds.has(`${baseId}-${seq}`)) {
    seq += 1
  }
  return `${baseId}-${seq}`
}

export function fetchMetroPrefixes() {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {}
  saveMetroPrefixes(INITIAL_METRO_PREFIXES)
  return INITIAL_METRO_PREFIXES
}

export function saveMetroPrefixes(prefixes) {
  try {
    localStorage.setItem(STORAGE_PREFIX_KEY, JSON.stringify(prefixes))
  } catch {}
}

export function fetchRetailStores() {
  const prefixes = fetchMetroPrefixes()
  try {
    const raw = localStorage.getItem(STORAGE_STORE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.map((s) => normalizeRetailStoreRecord(s, prefixes))
      }
    }
  } catch {}
  const seeded = INITIAL_RETAIL_STORES.map((s) => normalizeRetailStoreRecord(s, prefixes))
  saveRetailStores(seeded)
  return seeded
}

export function saveRetailStores(stores) {
  try {
    localStorage.setItem(STORAGE_STORE_KEY, JSON.stringify(stores))
  } catch {}
}

export function fetchHardwareVendors() {
  try {
    const raw = localStorage.getItem(STORAGE_VENDOR_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.map((v) => normalizeHardwareVendorRecord(v))
      }
    }
  } catch {}
  const seeded = INITIAL_HARDWARE_VENDORS.map((v) => normalizeHardwareVendorRecord(v))
  saveHardwareVendors(seeded)
  return seeded
}

export function saveHardwareVendors(vendors) {
  try {
    localStorage.setItem(STORAGE_VENDOR_KEY, JSON.stringify(vendors))
  } catch {}
}

export function fetchDispatchLogs() {
  try {
    const raw = localStorage.getItem(STORAGE_DISPATCH_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {}
  saveDispatchLogs(INITIAL_DISPATCH_LOGS)
  return INITIAL_DISPATCH_LOGS
}

export function saveDispatchLogs(logs) {
  try {
    localStorage.setItem(STORAGE_DISPATCH_KEY, JSON.stringify(logs))
  } catch {}
}

export function createRetailStore(payload = {}) {
  const current = fetchRetailStores()
  const prefixes = fetchMetroPrefixes()
  const storeName = String(payload.storeName || payload.name || '').trim()
  const address = String(payload.address || '').trim()
  const managerName = String(payload.managerName || payload.manager || '').trim()
  const cityCode = String(payload.cityCode || '101').trim()

  if (!storeName || !address || !managerName) {
    throw new Error('Store name, address, and manager name are required.')
  }

  const desiredCode = String(payload.storeCode || payload.code || '').trim().toUpperCase()
  const storeCode = desiredCode || getNextStoreCode(current, cityCode)
  if (current.some((s) => s.storeCode === storeCode)) {
    throw new Error(`Retail store code ${storeCode} already exists.`)
  }

  const created = normalizeRetailStoreRecord(
    {
      ...payload,
      storeCode,
      storeName,
      cityCode,
      address,
      managerName,
      status: payload.status || 'ACTIVE',
    },
    prefixes
  )

  const updated = [created, ...current]
  saveRetailStores(updated)
  return { store: created, stores: updated }
}

export function updateRetailStore(storeCode, updates = {}) {
  const targetCode = String(storeCode || '').trim().toUpperCase()
  const current = fetchRetailStores()
  const prefixes = fetchMetroPrefixes()
  const index = current.findIndex((s) => s.storeCode.toUpperCase() === targetCode)
  if (index === -1) {
    throw new Error(`Retail store ${storeCode} was not found.`)
  }

  const existing = current[index]
  const storeName =
    updates.storeName !== undefined || updates.name !== undefined
      ? String(updates.storeName ?? updates.name ?? '').trim()
      : existing.storeName
  const address =
    updates.address !== undefined ? String(updates.address || '').trim() : existing.address
  const managerName =
    updates.managerName !== undefined || updates.manager !== undefined
      ? String(updates.managerName ?? updates.manager ?? '').trim()
      : existing.managerName

  if (!storeName || !address || !managerName) {
    throw new Error('Store name, address, and manager name are required.')
  }

  const nextCityCode =
    updates.cityCode !== undefined ? String(updates.cityCode || '101').trim() : existing.cityCode
  const cityChanged = nextCityCode !== existing.cityCode
  const matchedPrefix = prefixes.find((p) => p.cityCode === nextCityCode)

  const merged = normalizeRetailStoreRecord(
    {
      ...existing,
      ...updates,
      storeCode: existing.storeCode,
      storeName,
      cityCode: nextCityCode,
      cityName: cityChanged
        ? matchedPrefix?.cityName || 'Metro Hub'
        : updates.cityName || existing.cityName,
      address,
      managerName,
    },
    prefixes
  )

  const updated = current.map((s) => (s.storeCode.toUpperCase() === targetCode ? merged : s))
  saveRetailStores(updated)
  return { store: merged, stores: updated }
}

export function deleteRetailStore(storeCode) {
  const targetCode = String(storeCode || '').trim().toUpperCase()
  const current = fetchRetailStores()
  const target = current.find((s) => s.storeCode.toUpperCase() === targetCode)
  if (!target) {
    throw new Error(`Retail store ${storeCode} was not found.`)
  }
  const updated = current.filter((s) => s.storeCode.toUpperCase() !== targetCode)
  saveRetailStores(updated)
  return { deleted: target, stores: updated }
}

export function createHardwareVendor(payload = {}) {
  const current = fetchHardwareVendors()
  const vendorName = String(payload.vendorName || payload.name || '').trim()
  const flagshipProduct = String(payload.flagshipProduct || payload.category || '').trim()

  if (!vendorName || !flagshipProduct) {
    throw new Error('Vendor partner name and flagship hardware product are required.')
  }

  const desiredId = String(payload.id || payload.code || '').trim().toUpperCase()
  const vendorId = desiredId || getNextVendorId(current, vendorName)
  if (current.some((v) => v.id === vendorId)) {
    throw new Error(`Vendor ID ${vendorId} already exists.`)
  }
  if (current.some((v) => v.vendorName.toLowerCase() === vendorName.toLowerCase())) {
    throw new Error(`Vendor "${vendorName}" already exists.`)
  }

  const unitCostUSD = Number(payload.unitCostUSD ?? 0)
  const monthlySupply = Number(payload.monthlySupply ?? 0)
  const availableStock = Number(payload.availableStock ?? 0)
  if (unitCostUSD < 0 || monthlySupply < 0 || availableStock < 0) {
    throw new Error('Unit cost, monthly supply, and available stock must be non-negative.')
  }

  const created = normalizeHardwareVendorRecord({
    ...payload,
    id: vendorId,
    vendorName,
    flagshipProduct,
    unitCostUSD,
    monthlySupply,
    availableStock,
    status: payload.status || 'APPROVED',
  })

  const updated = [created, ...current]
  saveHardwareVendors(updated)
  return { vendor: created, vendors: updated }
}

export function updateHardwareVendor(vendorId, updates = {}) {
  const targetId = String(vendorId || '').trim().toUpperCase()
  const current = fetchHardwareVendors()
  const existing = current.find((v) => v.id.toUpperCase() === targetId)
  if (!existing) {
    throw new Error(`Hardware vendor ${vendorId} was not found.`)
  }

  const vendorName =
    updates.vendorName !== undefined || updates.name !== undefined
      ? String(updates.vendorName ?? updates.name ?? '').trim()
      : existing.vendorName
  const flagshipProduct =
    updates.flagshipProduct !== undefined || updates.category !== undefined
      ? String(updates.flagshipProduct ?? updates.category ?? '').trim()
      : existing.flagshipProduct

  if (!vendorName || !flagshipProduct) {
    throw new Error('Vendor partner name and flagship hardware product are required.')
  }
  if (
    current.some(
      (v) => v.id.toUpperCase() !== targetId && v.vendorName.toLowerCase() === vendorName.toLowerCase()
    )
  ) {
    throw new Error(`Another vendor record already uses name "${vendorName}".`)
  }

  const unitCostUSD =
    updates.unitCostUSD !== undefined ? Number(updates.unitCostUSD) : existing.unitCostUSD
  const monthlySupply =
    updates.monthlySupply !== undefined ? Number(updates.monthlySupply) : existing.monthlySupply
  const availableStock =
    updates.availableStock !== undefined ? Number(updates.availableStock) : existing.availableStock
  if (
    !Number.isFinite(unitCostUSD) ||
    unitCostUSD < 0 ||
    !Number.isFinite(monthlySupply) ||
    monthlySupply < 0 ||
    !Number.isFinite(availableStock) ||
    availableStock < 0
  ) {
    throw new Error('Unit cost, monthly supply, and available stock must be non-negative numbers.')
  }

  const merged = normalizeHardwareVendorRecord({
    ...existing,
    ...updates,
    id: existing.id,
    vendorName,
    flagshipProduct,
    unitCostUSD,
    monthlySupply,
    availableStock,
  })

  const updated = current.map((v) => (v.id.toUpperCase() === targetId ? merged : v))
  saveHardwareVendors(updated)
  return { vendor: merged, vendors: updated }
}

export function deleteHardwareVendor(vendorId) {
  const targetId = String(vendorId || '').trim().toUpperCase()
  const current = fetchHardwareVendors()
  const target = current.find((v) => v.id.toUpperCase() === targetId)
  if (!target) {
    throw new Error(`Hardware vendor ${vendorId} was not found.`)
  }
  const updated = current.filter((v) => v.id.toUpperCase() !== targetId)
  saveHardwareVendors(updated)
  return { deleted: target, vendors: updated }
}

export function addRetailStore(storeData) {
  return createRetailStore(storeData).stores
}

export function addHardwareVendor(vendorData) {
  return createHardwareVendor(vendorData).vendors
}

export function generateTestAccountId(serviceType = 'B', cityCode = '101', serialNumber = 89) {
  const paddedSerial = String(serialNumber).padStart(12, '0')
  return `${serviceType}${cityCode}${paddedSerial}`
}

