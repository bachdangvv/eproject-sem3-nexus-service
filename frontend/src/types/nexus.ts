/**
 * Shared TypeScript domain models, DTO interfaces, and API error definitions
 * for the Nexus Service Marketing System frontend.
 */

export type StaffRole = 'Admin' | 'Retail' | 'Technical' | 'Billing';

export type UserRole = StaffRole | 'Customer';

export type ServiceTypeCode = 'D' | 'B' | 'T';

export type PublicServiceType = 'DIAL_UP' | 'BROADBAND' | 'LANDLINE';

export type OrderStatus = 'Pending' | 'Feasible' | 'NotFeasible' | 'Connected';

export type BillingStatus = 'NotBilled' | 'Unpaid' | 'PartiallyPaid' | 'Paid';

export type CustomerStatus = 'ACTIVE' | 'SUSPENDED';

export interface SessionResponse {
  csrfToken: string | null;
  username: string | null;
  displayName: string | null;
  role: UserRole | null;
  customerId?: number | null;
  customerCode?: string | null;
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
  localCallRate?: number;
  stdCallRate?: number;
  mobileMsgRate?: number;
  validityMonths: number;
  hoursAllowance?: number | null;
  speedKbps?: number | null;
}

export interface ProductView {
  id: number;
  name: string;
  description: string;
  active: boolean;
  quantityInStock: number;
  replacementPrice: number;
}

export interface EmployeeView {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
  active?: boolean;
  retailShopId?: number | null;
  customerId?: number | null;
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
  connectionCount?: number;
}

export interface OrderView {
  code: string;
  requestId: number;
  status: OrderStatus;
  request: RequestView;
  createdAt: string;
  accountId: string | null;
  activatedAt: string | null;
  assignedProductId?: number | null;
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

export interface InvoiceItemView {
  id: number;
  invoiceNumber: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  rentalAmount: number;
  callUsageAmount: number;
  equipmentFee: number;
  subtotal: number;
  discountAmount: number;
  discountPercent: number;
  taxAmount: number;
  depositAmount: number;
  previousDueBalance: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
}

export interface PaymentItemView {
  id: number;
  invoiceId: number;
  amount: number;
  paidAt: string;
  paidByUsername: string;
  channel: string;
  note: string | null;
}

export interface BillingView {
  accountId: string;
  orderId: string;
  customerName: string;
  planName: string;
  amount: number;
  status: BillingStatus;
  paidAt: string | null;
  invoiceId?: number | null;
  invoiceNumber?: string | null;
  rentalAmount?: number;
  callUsageAmount?: number;
  equipmentFee?: number;
  subtotal?: number;
  discountAmount?: number;
  discountPercent?: number;
  taxAmount?: number;
  depositAmount?: number;
  previousDueBalance?: number;
  totalAmount?: number;
  paidAmount?: number;
  dueAmount?: number;
  connectionCount?: number;
  localMinutes?: number;
  stdMinutes?: number;
  mobileMinutes?: number;
  billingPeriodStart?: string | null;
  billingPeriodEnd?: string | null;
  paidByUsername?: string | null;
  connectionStatus?: ConnectionStatus | string;
  refundStatus?: RefundStatus;
  refundAmount?: number;
  refundedAt?: string | null;
  invoices?: InvoiceItemView[];
  payments?: PaymentItemView[];
}

export interface PublicTrackView {
  type: 'order' | 'account';
  id: string;
  orderId: string;
  serviceType: PublicServiceType;
  status: OrderStatus | ConnectionStatus | 'ACTIVE';
  cityCode: string;
  accountId: string | null;
  dueAmount?: number | null;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface CityInput {
  code: string;
  name: string;
}

export interface CityUpdateInput {
  name: string;
}

export interface PlanInput {
  name: string;
  type: ServiceTypeCode;
  description?: string | null;
  price: number;
  active: boolean;
  localCallRate?: number;
  stdCallRate?: number;
  mobileMsgRate?: number;
  validityMonths?: number;
  hoursAllowance?: number | null;
  speedKbps?: number | null;
}

export interface ProductInput {
  name: string;
  description?: string | null;
  active: boolean;
  quantityInStock?: number;
  replacementPrice?: number;
}

export interface RetailShopView {
  id: number;
  code: string;
  name: string;
  cityCode: string;
  cityName?: string | null;
  address: string;
  phone: string;
  active: boolean;
}

export interface RetailShopInput {
  code: string;
  name: string;
  cityCode: string;
  address: string;
  phone: string;
  active?: boolean;
}

export interface VendorView {
  id: number;
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  active: boolean;
}

export interface VendorInput {
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  active?: boolean;
}

export type PurchaseOrderStatus = 'Ordered' | 'Received' | 'Cancelled';

export interface PurchaseOrderView {
  id: number;
  orderNumber: string;
  vendorId: number;
  vendorName: string;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  status: PurchaseOrderStatus;
  orderedAt: string;
  receivedAt: string | null;
  note: string | null;
  paidAmount: number;
  paymentStatus: 'Unpaid' | 'PartiallyPaid' | 'Paid';
}

export interface PurchaseOrderInput {
  vendorId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  note?: string | null;
}

export type VendorPaymentMethod = 'BankTransfer' | 'Cheque' | 'Cash';

export interface VendorPaymentView {
  id: number;
  paymentNumber: string;
  purchaseOrderId: number;
  purchaseOrderNumber: string;
  vendorId: number;
  vendorName: string;
  amount: number;
  paidAt: string;
  method: VendorPaymentMethod;
  reference: string | null;
  note: string | null;
}

export interface VendorPaymentInput {
  purchaseOrderId: number;
  amount: number;
  method: VendorPaymentMethod;
  reference?: string | null;
  note?: string | null;
}

export interface EquipmentStockView {
  id: number;
  name: string;
  description: string;
  active: boolean;
  quantityInStock: number;
  replacementPrice: number;
  pendingAllocations: number;
  allocatedCount: number;
}

export interface EquipmentInventorySummaryView {
  pendingFeasibleOrders: number;
}

export interface EquipmentIncidentView {
  id: number;
  connectionId: number;
  accountId: string;
  customerName?: string | null;
  customerPhone?: string | null;
  productId: number;
  productName: string;
  incidentDate: string;
  description: string;
  replacementFee: number;
  recordedByUsername: string;
  settled: boolean;
}

export interface EquipmentIncidentInput {
  connectionId?: number | null;
  accountId?: string | null;
  productId: number;
  description: string;
  replacementFee?: number;
}

export interface ConnectOrderInput {
  productId?: number | null;
}

export interface EmployeeInput {
  username: string;
  displayName: string;
  role: StaffRole;
  password: string;
}

export interface RegisterCustomerInput {
  name: string;
  phone: string;
  address: string;
  cityCode: string;
  username: string;
  password: string;
  email?: string | null;
  contactPerson?: string | null;
  taxId?: string | null;
  customerType?: string | null;
}

export interface CustomerRegistrationView {
  customerId: number;
  customerCode: string;
  username: string;
  displayName: string;
  role: UserRole;
}

export interface CustomerProfileView extends CustomerView {
  username: string;
  active: boolean;
}

export interface CustomerProfileInput {
  name: string;
  phone: string;
  address: string;
  cityCode: string;
  email?: string | null;
  contactPerson?: string | null;
  taxId?: string | null;
  customerType?: string | null;
}

export interface CustomerRequestInput {
  planId: number;
  hasNexusLandline: boolean;
  connectionCount?: number;
  address?: string | null;
  cityCode?: string | null;
}

export interface CustomerPaymentInput {
  invoiceId?: number | null;
  amount?: number | null;
  note?: string | null;
}

export interface CustomerSelfQueryInput {
  subject: string;
  category: CustomerQueryCategory;
  question: string;
}

export interface EmployeeUpdateInput {
  displayName: string;
  role: UserRole;
  password?: string | null;
  active?: boolean;
  retailShopId?: number | null;
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
  connectionCount?: number;
}

export interface CreateInvoiceInput {
  localMinutes?: number;
  stdMinutes?: number;
  mobileMinutes?: number;
  equipmentFee?: number;
  includeDeposit?: boolean;
  periodStart?: string;
  periodEnd?: string;
}

export interface RecordPaymentInput {
  amount?: number;
  channel?: string;
  note?: string;
}

export interface RefundDepositInput {
  note?: string | null;
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

export type ConnectionStatus = 'Active' | 'TemporarilyInactive' | 'PermanentlyInactive';

export type RefundStatus = 'Pending' | 'Refunded' | 'Processed' | 'Forfeited' | 'None' | string;

export interface ConnectionLifecycleView {
  id: number;
  accountId: string;
  orderId: number;
  type: ServiceTypeCode;
  cityCode: string;
  status: ConnectionStatus;
  suspendReason: string | null;
  suspendedAt: string | null;
  terminatedAt: string | null;
  refundStatus: RefundStatus | null;
  refundAmount: number | null;
  customerName: string;
  customerPhone: string;
  planName: string;
  activatedAt: string;
}

export interface SuspendConnectionInput {
  reason: string;
}

export interface TerminateConnectionInput {
  note?: string | null;
}

export interface ConnectionQueryParams {
  q?: string;
  code?: string;
  customerName?: string;
  serviceType?: string;
  phone?: string;
  fromDate?: string;
  toDate?: string;
  status?: string;
  cityCode?: string;
}

export interface OrderSearchParams {
  code?: string;
  customerName?: string;
  serviceType?: ServiceTypeCode | 'ALL' | string;
  phone?: string;
  fromDate?: string;
  toDate?: string;
  status?: OrderStatus | 'ALL' | string;
}

export interface OrderAdvancedSearchFilters {
  code: string;
  customerName: string;
  serviceType: string;
  fromDate: string;
  toDate: string;
  phone: string;
}

export const DEFAULT_ADVANCED_SEARCH_FILTERS: OrderAdvancedSearchFilters = {
  code: '',
  customerName: '',
  serviceType: 'ALL',
  fromDate: '',
  toDate: '',
  phone: '',
};

export type CustomerDocumentType =
  | 'AddressProof'
  | 'RegistrationForm'
  | 'PaymentReceipt'
  | 'Other';

export interface CustomerDocumentView {
  id: number;
  customerId: number;
  customerName: string;
  documentType: CustomerDocumentType;
  title: string;
  filePathOrUrl: string;
  originalFileName: string | null;
  contentType: string | null;
  fileSizeBytes: number | null;
  hasStoredFile: boolean;
  year: number;
  cityCode: string;
  uploadedAt: string;
  uploadedById: number;
  uploadedByName: string | null;
}

export interface CustomerDocumentInput {
  customerId: number;
  documentType: CustomerDocumentType;
  title: string;
  filePathOrUrl: string;
  year: number;
  cityCode: string;
}

export interface UploadCustomerDocumentInput {
  customerId: number;
  documentType: CustomerDocumentType;
  title: string;
  year: number;
  cityCode: string;
  file: File;
}

export interface DocumentQueryParams {
  year?: number;
  cityCode?: string;
  customerId?: number;
  documentType?: CustomerDocumentType | 'ALL' | string;
}

export type PlanChangeStatus = 'Pending' | 'Approved' | 'Rejected';

export interface PlanChangeRequestView {
  id: number;
  connectionId: number;
  accountId: string | null;
  customerName: string;
  serviceType: ServiceTypeCode | string;
  currentPlanId: number;
  currentPlanName: string;
  currentPlanPrice: number;
  targetPlanId: number;
  targetPlanName: string;
  targetPlanPrice: number;
  requestedAt: string;
  status: PlanChangeStatus;
  note: string | null;
  reviewedById: number | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
}

export interface PlanChangeRequestInput {
  connectionId: number;
  targetPlanId: number;
  note?: string | null;
}

export interface RejectPlanChangeInput {
  note?: string | null;
}

export interface PlanChangeQueryParams {
  status?: PlanChangeStatus | 'ALL' | string;
  connectionId?: number;
}

export type CustomerQueryStatus = 'Open' | 'Answered' | 'Closed';

export type CustomerQueryCategory = 'Billing' | 'Technical' | 'Plan' | 'General';

export interface CustomerQueryView {
  id: number;
  customerId: number;
  customerName: string;
  subject: string;
  category: CustomerQueryCategory | string;
  question: string;
  answer: string | null;
  status: CustomerQueryStatus;
  createdAt: string;
  answeredAt: string | null;
  answeredById: number | null;
  answeredByName: string | null;
  isFaq: boolean;
}

export interface FaqItemView {
  id: number;
  category: CustomerQueryCategory | string;
  subject: string;
  question: string;
  answer: string;
}

export interface CustomerQueryInput {
  customerId: number;
  subject: string;
  category: CustomerQueryCategory;
  question: string;
}

export interface AnswerQueryInput {
  answer: string;
  isFaq: boolean;
}

export interface CustomerQueryParams {
  status?: CustomerQueryStatus | 'ALL' | string;
  category?: CustomerQueryCategory | 'ALL' | string;
  customerId?: number;
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
  validityMonths?: 1 | 3 | 6 | 12;
  hoursAllowance?: number | null;
  speedKbps?: number | null;
}
