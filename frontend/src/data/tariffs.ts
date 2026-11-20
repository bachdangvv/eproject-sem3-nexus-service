import type { ConnectionType, ServicePlan } from '../types/nexus';

export const SERVICE_TAX_RATE = 0.1224; // 12.24% government service tax

export const SECURITY_DEPOSIT_USD: Record<ConnectionType, number> = {
  D: 325,
  B: 500,
  T: 250,
};

export const CONNECTION_TYPE_LABEL: Record<ConnectionType, string> = {
  D: 'Dial-Up Connection',
  B: 'Broadband Connection',
  T: 'Landline Connection',
};

export const CONNECTION_TYPE_SHORT: Record<ConnectionType, string> = {
  D: 'Dial-Up (D)',
  B: 'Broadband (B)',
  T: 'Landline (T)',
};

export interface BulkDiscountTier {
  rangeLabel: string;
  minConnections: number;
  maxConnections: number | null;
  discountPercent: number;
  appliesTo: string;
}

export const BULK_DISCOUNT_TIERS: BulkDiscountTier[] = [
  {
    rangeLabel: '1–9 connections',
    minConnections: 1,
    maxConnections: 9,
    discountPercent: 0,
    appliesTo: 'Standard single/small-office pricing',
  },
  {
    rangeLabel: '10–14 connections',
    minConnections: 10,
    maxConnections: 14,
    discountPercent: 25,
    appliesTo: '25% off Advance & Security Deposit',
  },
  {
    rangeLabel: '15–24 connections',
    minConnections: 15,
    maxConnections: 24,
    discountPercent: 50,
    appliesTo: '50% off Advance & Security Deposit',
  },
  {
    rangeLabel: '25–50 connections',
    minConnections: 25,
    maxConnections: 50,
    discountPercent: 75,
    appliesTo: '75% off Advance & Security Deposit',
  },
  {
    rangeLabel: 'Above 50 connections',
    minConnections: 51,
    maxConnections: null,
    discountPercent: 100,
    appliesTo: '100% off Advance & Security Deposit',
  },
];

export function getBulkDiscountPercent(connectionCount: number): number {
  const qty = Math.max(1, Math.floor(connectionCount || 1));
  if (qty > 50) return 100;
  if (qty >= 25) return 75;
  if (qty >= 15) return 50;
  if (qty >= 10) return 25;
  return 0;
}

export function roundUsd(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatUsd(value: number): string {
  return `$${roundUsd(value).toFixed(2)}`;
}

export function computeBillAmounts(params: {
  connectionType: ConnectionType;
  planRentalUsd: number;
  connectionCount: number;
  includeSecurityDeposit: boolean;
  usageChargesUsd: number;
  equipmentReplacementUsd: number;
  previousArrearsUsd: number;
  advanceAdjustmentUsd: number;
}) {
  const qty = Math.max(1, Math.floor(params.connectionCount || 1));
  const discountPercent = getBulkDiscountPercent(qty);
  const depositPerLine = params.includeSecurityDeposit ? SECURITY_DEPOSIT_USD[params.connectionType] : 0;
  const securityDepositGrossUsd = roundUsd(depositPerLine * qty);
  const rentalTotalUsd = roundUsd(params.planRentalUsd * qty);

  // Bulk discount applies to advance rental and security deposit
  const discountOnRental = roundUsd((rentalTotalUsd * discountPercent) / 100);
  const discountOnDeposit = roundUsd((securityDepositGrossUsd * discountPercent) / 100);
  const bulkDiscountAmountUsd = roundUsd(discountOnRental + discountOnDeposit);

  const netRentalUsd = roundUsd(rentalTotalUsd - discountOnRental);
  const netDepositUsd = roundUsd(securityDepositGrossUsd - discountOnDeposit);

  // 12.24% Service tax applies ONLY to taxable services (rental net of discount, usage, equipment)
  // Refundable security deposit is strictly non-taxable
  const taxableServicesUsd = roundUsd(
    Math.max(0, netRentalUsd + params.usageChargesUsd + params.equipmentReplacementUsd),
  );
  const serviceTaxUsd = roundUsd(taxableServicesUsd * SERVICE_TAX_RATE);
  const subtotalBeforeTaxUsd = roundUsd(taxableServicesUsd + netDepositUsd + params.previousArrearsUsd);
  const totalBilledUsd = roundUsd(
    taxableServicesUsd +
      serviceTaxUsd +
      netDepositUsd +
      params.previousArrearsUsd +
      params.advanceAdjustmentUsd,
  );

  return {
    discountPercent,
    securityDepositGrossUsd,
    rentalTotalUsd,
    bulkDiscountAmountUsd,
    netDepositUsd,
    taxableServicesUsd,
    subtotalBeforeTaxUsd,
    serviceTaxUsd,
    totalBilledUsd,
  };
}

export const SPECIFICATION_PLANS: ServicePlan[] = [
  // Dial-Up Plans (D)
  {
    id: 'plan-d-10h',
    code: 'DU-HR-10',
    name: 'Dial-Up Hourly 10 Hrs',
    type: 'D',
    category: 'Hourly',
    validityLabel: '1 Month',
    rentalUsd: 50,
    description: '10 hours dial-up internet access valid for 1 month. Requires Nexus landline.',
    active: true,
  },
  {
    id: 'plan-d-30h',
    code: 'DU-HR-30',
    name: 'Dial-Up Hourly 30 Hrs',
    type: 'D',
    category: 'Hourly',
    validityLabel: '3 Months',
    rentalUsd: 130,
    description: '30 hours dial-up internet access valid for 3 months. Requires Nexus landline.',
    active: true,
  },
  {
    id: 'plan-d-60h',
    code: 'DU-HR-60',
    name: 'Dial-Up Hourly 60 Hrs',
    type: 'D',
    category: 'Hourly',
    validityLabel: '6 Months',
    rentalUsd: 260,
    description: '60 hours dial-up internet access valid for 6 months. Requires Nexus landline.',
    active: true,
  },
  {
    id: 'plan-d-28k-m',
    code: 'DU-28K-M',
    name: 'Dial-Up Unlimited 28 Kbps (Monthly)',
    type: 'D',
    category: 'Unlimited',
    validityLabel: 'Monthly',
    rentalUsd: 75,
    description: 'Unlimited 28 Kbps dial-up connectivity billed monthly. Requires Nexus landline.',
    active: true,
  },
  {
    id: 'plan-d-28k-q',
    code: 'DU-28K-Q',
    name: 'Dial-Up Unlimited 28 Kbps (Quarterly)',
    type: 'D',
    category: 'Unlimited',
    validityLabel: 'Quarterly',
    rentalUsd: 150,
    description: 'Unlimited 28 Kbps dial-up connectivity billed quarterly. Requires Nexus landline.',
    active: true,
  },
  {
    id: 'plan-d-56k-m',
    code: 'DU-56K-M',
    name: 'Dial-Up Unlimited 56 Kbps (Monthly)',
    type: 'D',
    category: 'Unlimited',
    validityLabel: 'Monthly',
    rentalUsd: 100,
    description: 'Unlimited 56 Kbps high-reliability dial-up access billed monthly.',
    active: true,
  },
  {
    id: 'plan-d-56k-q',
    code: 'DU-56K-Q',
    name: 'Dial-Up Unlimited 56 Kbps (Quarterly)',
    type: 'D',
    category: 'Unlimited',
    validityLabel: 'Quarterly',
    rentalUsd: 180,
    description: 'Unlimited 56 Kbps high-reliability dial-up access billed quarterly.',
    active: true,
  },

  // Broadband Plans (B)
  {
    id: 'plan-b-30h',
    code: 'BB-HR-30',
    name: 'Broadband Hourly 30 Hrs',
    type: 'B',
    category: 'Hourly',
    validityLabel: '1 Month',
    rentalUsd: 175,
    description: '30 hours dedicated broadband access valid for 1 month via Modem or Router.',
    active: true,
  },
  {
    id: 'plan-b-60h',
    code: 'BB-HR-60',
    name: 'Broadband Hourly 60 Hrs',
    type: 'B',
    category: 'Hourly',
    validityLabel: '6 Months',
    rentalUsd: 315,
    description: '60 hours dedicated broadband access valid for 6 months via Modem or Router.',
    active: true,
  },
  {
    id: 'plan-b-64k-m',
    code: 'BB-64K-M',
    name: 'Broadband Unlimited 64 Kbps (Monthly)',
    type: 'B',
    category: 'Unlimited',
    validityLabel: 'Monthly',
    rentalUsd: 225,
    description: 'Always-on unlimited 64 Kbps broadband plan billed monthly.',
    active: true,
  },
  {
    id: 'plan-b-64k-q',
    code: 'BB-64K-Q',
    name: 'Broadband Unlimited 64 Kbps (Quarterly)',
    type: 'B',
    category: 'Unlimited',
    validityLabel: 'Quarterly',
    rentalUsd: 400,
    description: 'Always-on unlimited 64 Kbps broadband plan billed quarterly.',
    active: true,
  },
  {
    id: 'plan-b-128k-m',
    code: 'BB-128K-M',
    name: 'Broadband Unlimited 128 Kbps (Monthly)',
    type: 'B',
    category: 'Unlimited',
    validityLabel: 'Monthly',
    rentalUsd: 350,
    description: 'High-capacity unlimited 128 Kbps broadband plan billed monthly.',
    active: true,
  },
  {
    id: 'plan-b-128k-q',
    code: 'BB-128K-Q',
    name: 'Broadband Unlimited 128 Kbps (Quarterly)',
    type: 'B',
    category: 'Unlimited',
    validityLabel: 'Quarterly',
    rentalUsd: 445,
    description: 'High-capacity unlimited 128 Kbps broadband plan billed quarterly.',
    active: true,
  },

  // Landline Plans (T)
  {
    id: 'plan-t-local-y',
    code: 'LL-LOC-Y',
    name: 'Landline Local Unlimited (Yearly)',
    type: 'T',
    category: 'Local',
    validityLabel: '1 Year',
    rentalUsd: 75,
    localRateCents: 55,
    callRatesSummary: 'Local: 55 cents/min',
    description: 'Annual local landline rental ($75/yr) plus 55 cents/min local call charge.',
    active: true,
  },
  {
    id: 'plan-t-local-m',
    code: 'LL-LOC-M',
    name: 'Landline Local Monthly',
    type: 'T',
    category: 'Local',
    validityLabel: '1 Month',
    rentalUsd: 35,
    localRateCents: 75,
    callRatesSummary: 'Local: 75 cents/min',
    description: 'Monthly local landline rental ($35/mo) plus 75 cents/min local call charge.',
    active: true,
  },
  {
    id: 'plan-t-std-m',
    code: 'LL-STD-M',
    name: 'Landline STD Monthly',
    type: 'T',
    category: 'STD',
    validityLabel: '1 Month',
    rentalUsd: 125,
    localRateCents: 70,
    stdRateUsd: 2.25,
    mobileMsgRateUsd: 1.0,
    callRatesSummary: 'Local: 70¢/min · STD: $2.25/min · Mobile Msg: $1.00/min',
    description: 'Monthly STD landline rental ($125/mo) with local, STD, and mobile messaging.',
    active: true,
  },
  {
    id: 'plan-t-std-hy',
    code: 'LL-STD-HY',
    name: 'Landline STD Half-Yearly',
    type: 'T',
    category: 'STD',
    validityLabel: '6 Months',
    rentalUsd: 420,
    localRateCents: 60,
    stdRateUsd: 2.0,
    mobileMsgRateUsd: 1.15,
    callRatesSummary: 'Local: 60¢/min · STD: $2.00/min · Mobile Msg: $1.15/min',
    description: 'Half-yearly STD landline rental ($420) with reduced local and STD call tariffs.',
    active: true,
  },
  {
    id: 'plan-t-std-y',
    code: 'LL-STD-Y',
    name: 'Landline STD Yearly',
    type: 'T',
    category: 'STD',
    validityLabel: '1 Year',
    rentalUsd: 780,
    localRateCents: 60,
    stdRateUsd: 1.75,
    mobileMsgRateUsd: 1.25,
    callRatesSummary: 'Local: 60¢/min · STD: $1.75/min · Mobile Msg: $1.25/min',
    description: 'Annual STD landline rental ($780/yr) with lowest STD voice tariff ($1.75/min).',
    active: true,
  },
];
