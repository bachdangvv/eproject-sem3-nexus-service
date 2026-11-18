export type UserRole = 'Admin' | 'Retail' | 'Technical' | 'Billing';

export type ServiceTypeCode = 'D' | 'B' | 'T';

export type PublicServiceType = 'DIAL_UP' | 'BROADBAND' | 'LANDLINE';

export type OrderStatus = 'Pending' | 'Feasible' | 'NotFeasible' | 'Connected';

export type BillingStatus = 'NotBilled' | 'Unpaid' | 'Paid';

export type CustomerStatus = 'ACTIVE' | 'SUSPENDED';

export interface SessionResponse {
  csrfToken: string | null;
  username: string | null;
  displayName: string | null;
  role: UserRole | null;
  backendOffline?: boolean;
}

export interface CityView {
  code: string;
  name: string;
}

export interface PlanView {
  id: number;
  name: string;
  type: ServiceTypeCode;
  description: string;
  price: number;
  active: boolean;
}

export interface ProductView {
  id: number;
  name: string;
  description: string;
  active: boolean;
}

export interface EmployeeView {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
}

export interface CustomerView {
  id: number;
  code: string;
  name: string;
  phone: string;
  address: string;
  cityCode: string;
  taxId: string | null;
  email: string | null;
  contactPerson: string | null;
  customerType: string | null;
  status: CustomerStatus;
}

export interface RequestView {
  id: number;
  customerId: number;
  customerName: string;
  planId: number;
  planName: string;
  type: ServiceTypeCode;
  cityCode: string;
  address: string;
  hasNexusLandline: boolean;
  price: number;
  createdAt: string;
}

export interface OrderView {
  code: string;
  requestId: number;
  status: OrderStatus;
  request: RequestView;
  createdAt: string;
  accountId: string | null;
  activatedAt: string | null;
}

export interface OrderHistoryView {
  status: OrderStatus;
  at: string;
  actor: string;
  note: string;
  distanceOk: boolean | null;
  serverAvailable: boolean | null;
  landlineFeasible: boolean | null;
}

export interface FeedbackView {
  rating: number;
  comment: string;
  createdAt: string;
}

export interface CreatedFeedbackView {
  id: number;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface OrderDetailView {
  order: OrderView;
  history: OrderHistoryView[];
  feedback: FeedbackView[];
}

export interface BillingView {
  accountId: string;
  orderId: string;
  customerName: string;
  planName: string;
  amount: number;
  status: BillingStatus;
  paidAt: string | null;
}

export interface PublicTrackView {
  type: 'order' | 'account';
  id: string;
  orderId: string;
  serviceType: PublicServiceType;
  status: OrderStatus | 'ACTIVE';
  cityCode: string;
  accountId: string | null;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface CityInput {
  code: string;
  name: string;
}

export interface PlanInput {
  name: string;
  type: ServiceTypeCode;
  description?: string | null;
  price: number;
  active: boolean;
}

export interface ProductInput {
  name: string;
  description?: string | null;
  active: boolean;
}

export interface EmployeeInput {
  username: string;
  displayName: string;
  role: UserRole;
  password: string;
}

export interface CustomerInput {
  name: string;
  phone: string;
  address: string;
  cityCode: string;
  taxId?: string | null;
  email?: string | null;
  contactPerson?: string | null;
  customerType?: string | null;
  status?: CustomerStatus | null;
}

export interface RequestInput {
  customerId: number;
  planId: number;
  hasNexusLandline: boolean;
}

export interface AssessmentInput {
  distanceOk: boolean;
  serverAvailable: boolean;
  landlineFeasible?: boolean | null;
  note?: string | null;
}

export interface FeedbackInput {
  rating: number;
  comment: string;
}

export interface OrderQueryParams {
  code?: string;
  status?: OrderStatus | '';
}

export interface ApiErrorShape {
  status: number;
  title: string;
  detail?: string;
  errors?: Record<string, string[]>;
  message: string;
  backendOffline?: boolean;
}

export class ApiError extends Error implements ApiErrorShape {
  readonly status: number;
  readonly title: string;
  readonly detail?: string;
  readonly errors?: Record<string, string[]>;
  readonly backendOffline?: boolean;

  constructor(init: ApiErrorShape) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.title = init.title;
    this.detail = init.detail;
    this.errors = init.errors;
    this.backendOffline = init.backendOffline;
  }
}

/** @deprecated Compatibility alias kept for data/tariffs.ts until M2 cleanup */
export type ConnectionType = ServiceTypeCode;

/** @deprecated Compatibility interface kept for data/tariffs.ts until M2 cleanup */
export interface ServicePlan {
  id: string;
  code: string;
  name: string;
  type: ConnectionType;
  category: 'Hourly' | 'Unlimited' | 'Local' | 'STD';
  validityLabel: string;
  rentalUsd: number;
  callRatesSummary?: string;
  localRateCents?: number;
  stdRateUsd?: number;
  mobileMsgRateUsd?: number;
  description: string;
  active: boolean;
}
