import { fetchOrders, findOrderById } from '../orderService.js'
import { getActivatedAccounts } from '../activationService.js'
import { sanitizePublicTrackingPayload } from '../../utils/publicTracking.js'

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export const MOCK_ORDERS = {
  D0000000001: {
    serviceType: 'DIAL_UP',
    status: 'FEASIBLE',
    route: 'Hoan Kiem – Ba Dinh #8839',
    note: 'POS/ATM Circuit - Vincom Hanoi',
    customerName: 'Vincom Retail Joint Stock Co.',
    createdAt: '2026-03-01T08:30:00Z',
    depositPaidUSD: 325,
  },
  B0000000001: {
    serviceType: 'BROADBAND',
    status: 'IN_PROGRESS',
    route: 'District 1 – District 3 #2210',
    note: 'Leased Line Techcom - Saigon',
    customerName: 'Techcombank Financial Center',
    createdAt: '2026-03-02T09:15:00Z',
    depositPaidUSD: 500,
  },
  T0000000001: {
    serviceType: 'LANDLINE',
    status: 'PENDING_SURVEY',
    route: 'Hai Chau – Thanh Khe #1045',
    note: 'SIP Trunking Da Nang',
    customerName: 'Da Nang Software Park JSC',
    createdAt: '2026-03-03T10:45:00Z',
    depositPaidUSD: 250,
  },
  B0000001089: {
    serviceType: 'BROADBAND',
    status: 'FEASIBLE',
    route: 'Hoan Kiem Branch HN-101 (ODF-04)',
    note: '500Mbps Metro Dedicated - AlphaCorp',
    customerName: 'AlphaCorp Technology Solutions JSC',
    createdAt: '2026-03-04T11:00:00Z',
    depositPaidUSD: 500,
  },
  B0000001058: {
    serviceType: 'BROADBAND',
    status: 'NOT_FEASIBLE',
    route: 'Ngu Hanh Son Da Nang #DN-88',
    note: 'Exceeds 400m drop limit - Refund queue',
    customerName: 'Hai Ha Logistics Co. Ltd.',
    createdAt: '2026-03-04T14:20:00Z',
    depositPaidUSD: 500,
  },
}

export const MOCK_ACCOUNTS = {
  B001000000000001: {
    serviceType: 'BROADBAND',
    status: 'ACTIVE',
    route: 'Hoan Kiem – Ba Dinh #8839',
    bandwidth: '10 Gbps',
    due: 0,
    customerName: 'FPT Software Corporation',
    assignedONT: 'NX-GPON-9942A (SN: NX0942A00098418)',
  },
  D001000000000001: {
    serviceType: 'DIAL_UP',
    status: 'ACTIVE',
    route: 'Hai Ba Trung #1102',
    bandwidth: '56 Kbps',
    due: 0,
    customerName: 'Vietcombank ATM Network',
    assignedONT: 'Modem V.92 POS Terminal',
  },
  T001000000000001: {
    serviceType: 'LANDLINE',
    status: 'ACTIVE',
    route: 'District 1 HCMC #4412',
    bandwidth: '30 SIP Channels',
    due: 0,
    customerName: 'FastCall Teleservices Call Center',
    assignedONT: 'SBC Enterprise Gateway',
  },
}

export async function fetchMockTracking(type, rawId) {
  await delay(200)
  const normalizedType = String(type || '').trim().toLowerCase()
  const id = String(rawId || '').trim().toUpperCase()
  if (!id) {
    throw new Error('Please enter a valid Order ID or Account ID.')
  }

  if (normalizedType === 'order') {
    const liveOrder = findOrderById(id)
    if (liveOrder) {
      const linkedCircuit = getActivatedAccounts().find(
        (a) => String(a.orderId || '').trim().toUpperCase() === id
      )
      return sanitizePublicTrackingPayload({
        type: 'order',
        id: liveOrder.id,
        serviceType:
          liveOrder.serviceType === 'DIALUP' ? 'DIAL_UP' : liveOrder.serviceType || 'BROADBAND',
        status: liveOrder.status,
        cityCode: liveOrder.cityCode || liveOrder.branchCode,
        branchName: liveOrder.branchName,
        address: liveOrder.address,
        route: liveOrder.route || liveOrder.odnBox || liveOrder.odfName || liveOrder.branchName || liveOrder.address,
        customerName: liveOrder.customerName,
        accountId: linkedCircuit?.accountId || liveOrder.accountId || null,
      })
    }

    const fallbackOrder = MOCK_ORDERS[id]
    if (fallbackOrder) {
      return sanitizePublicTrackingPayload({ type: 'order', id, ...fallbackOrder })
    }

    throw new Error(
      `Could not find order with identifier ${id}. Please verify the code on your agreement.`
    )
  }

  const liveAccount = getActivatedAccounts().find(
    (a) => String(a.accountId || '').trim().toUpperCase() === id
  )
  if (liveAccount) {
    return sanitizePublicTrackingPayload({
      type: 'account',
      id: liveAccount.accountId,
      orderId: liveAccount.orderId,
      serviceType:
        liveAccount.serviceType === 'DIALUP' ? 'DIAL_UP' : liveAccount.serviceType || 'BROADBAND',
      status: liveAccount.status || 'ACTIVE',
      cityCode: liveAccount.cityCode || liveAccount.branchCode,
      branchName: liveAccount.branchName,
      address: liveAccount.installationAddress,
      route: liveAccount.installationAddress || `City ${liveAccount.cityCode || '101'}`,
      bandwidth: liveAccount.qualityMetrics?.throughput || liveAccount.serviceTitle,
      customerName: liveAccount.customerName,
    })
  }

  const orderByAccount = fetchOrders().find(
    (o) => String(o.accountId || '').trim().toUpperCase() === id
  )
  if (orderByAccount) {
    return sanitizePublicTrackingPayload({
      type: 'account',
      id,
      orderId: orderByAccount.id,
      serviceType:
        orderByAccount.serviceType === 'DIALUP'
          ? 'DIAL_UP'
          : orderByAccount.serviceType || 'BROADBAND',
      status: orderByAccount.status === 'ACTIVATED' ? 'ACTIVE' : orderByAccount.status,
      cityCode: orderByAccount.cityCode || orderByAccount.branchCode,
      branchName: orderByAccount.branchName,
      address: orderByAccount.address,
      route:
        orderByAccount.route ||
        orderByAccount.odnBox ||
        orderByAccount.odfName ||
        orderByAccount.address ||
        orderByAccount.branchName,
      bandwidth: orderByAccount.planName || orderByAccount.serviceName,
      customerName: orderByAccount.customerName,
    })
  }

  const fallbackAccount = MOCK_ACCOUNTS[id]
  if (fallbackAccount) {
    return sanitizePublicTrackingPayload({ type: 'account', id, ...fallbackAccount })
  }

  throw new Error(
    `Could not find account with identifier ${id}. Please verify the code on your agreement.`
  )
}
