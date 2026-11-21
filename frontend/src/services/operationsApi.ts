/**
 * Operations API client covering customers, service requests, orders, assessments,
 * connection lifecycle transitions, document archival, and plan-change workflows.
 */
import type {
  AssessmentInput,
  ConnectionLifecycleView,
  ConnectionQueryParams,
  CreatedFeedbackView,
  CustomerDocumentInput,
  CustomerDocumentView,
  CustomerInput,
  CustomerView,
  DocumentQueryParams,
  FeedbackInput,
  OrderDetailView,
  OrderQueryParams,
  OrderSearchParams,
  OrderView,
  PlanChangeQueryParams,
  PlanChangeRequestInput,
  PlanChangeRequestView,
  RejectPlanChangeInput,
  RequestInput,
  RequestView,
  SuspendConnectionInput,
  TerminateConnectionInput,
  UploadCustomerDocumentInput,
} from '../types/nexus';
import { apiRequest, normalizeOptionalString } from './apiClient';

function sanitizeCustomerInput(input: CustomerInput): CustomerInput {
  return {
    name: input.name.trim(),
    phone: input.phone.trim(),
    address: input.address.trim(),
    cityCode: input.cityCode.trim(),
    taxId: normalizeOptionalString(input.taxId),
    email: normalizeOptionalString(input.email),
    contactPerson: normalizeOptionalString(input.contactPerson),
    customerType: normalizeOptionalString(input.customerType),
    status: (normalizeOptionalString(input.status) as CustomerInput['status']) ?? null,
  };
}

export function getCustomers(q?: string): Promise<CustomerView[]> {
  const trimmed = q?.trim();
  const query = trimmed ? `?q=${encodeURIComponent(trimmed)}` : '';
  return apiRequest<CustomerView[]>(`/customers${query}`);
}

export function createCustomer(input: CustomerInput): Promise<CustomerView> {
  return apiRequest<CustomerView>('/customers', {
    method: 'POST',
    body: JSON.stringify(sanitizeCustomerInput(input)),
  });
}

export function updateCustomer(id: number, input: CustomerInput): Promise<CustomerView> {
  return apiRequest<CustomerView>(`/customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(sanitizeCustomerInput(input)),
  });
}

export function getRequests(): Promise<RequestView[]> {
  return apiRequest<RequestView[]>('/requests');
}

export function createRequest(input: RequestInput): Promise<RequestView> {
  return apiRequest<RequestView>('/requests', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function confirmRequest(id: number): Promise<OrderView> {
  return apiRequest<OrderView>(`/requests/${id}/confirm`, {
    method: 'POST',
  });
}

export function getOrders(params?: OrderQueryParams): Promise<OrderView[]> {
  const search = new URLSearchParams();
  if (params?.code?.trim()) {
    search.set('code', params.code.trim().toUpperCase());
  }
  if (params?.status) {
    search.set('status', params.status);
  }
  const qs = search.toString();
  return apiRequest<OrderView[]>(`/orders${qs ? `?${qs}` : ''}`);
}

export function getOrderDetail(code: string): Promise<OrderDetailView> {
  return apiRequest<OrderDetailView>(`/orders/${encodeURIComponent(code.trim().toUpperCase())}`);
}

export function assessOrder(code: string, input: AssessmentInput): Promise<OrderView> {
  return apiRequest<OrderView>(
    `/orders/${encodeURIComponent(code.trim().toUpperCase())}/assessment`,
    {
      method: 'POST',
      body: JSON.stringify({
        distanceOk: input.distanceOk,
        serverAvailable: input.serverAvailable,
        landlineFeasible: input.landlineFeasible ?? null,
        note: normalizeOptionalString(input.note),
      }),
    },
  );
}

export function submitFeedback(code: string, input: FeedbackInput): Promise<CreatedFeedbackView> {
  return apiRequest<CreatedFeedbackView>(
    `/orders/${encodeURIComponent(code.trim().toUpperCase())}/feedback`,
    {
      method: 'POST',
      body: JSON.stringify({
        rating: input.rating,
        comment: input.comment.trim(),
      }),
    },
  );
}

export function getConnections(params?: ConnectionQueryParams): Promise<ConnectionLifecycleView[]> {
  const search = new URLSearchParams();
  if (params?.q?.trim()) {
    search.set('q', params.q.trim());
  }
  if (params?.code?.trim()) {
    search.set('code', params.code.trim().toUpperCase());
  }
  if (params?.customerName?.trim()) {
    search.set('customerName', params.customerName.trim());
  }
  if (params?.serviceType && params.serviceType !== 'ALL' && params.serviceType.trim()) {
    search.set('serviceType', params.serviceType.trim().toUpperCase());
  }
  if (params?.phone?.trim()) {
    search.set('phone', params.phone.trim());
  }
  if (params?.fromDate?.trim()) {
    search.set('fromDate', params.fromDate.trim());
  }
  if (params?.toDate?.trim()) {
    search.set('toDate', params.toDate.trim());
  }
  if (params?.status && params.status !== 'ALL') {
    search.set('status', params.status);
  }
  if (params?.cityCode && params.cityCode !== 'ALL' && params.cityCode.trim()) {
    search.set('cityCode', params.cityCode.trim());
  }
  const qs = search.toString();
  return apiRequest<ConnectionLifecycleView[]>(`/connections${qs ? `?${qs}` : ''}`);
}

export function suspendConnection(
  accountId: string,
  input: SuspendConnectionInput,
): Promise<ConnectionLifecycleView> {
  return apiRequest<ConnectionLifecycleView>(
    `/technical/connections/${encodeURIComponent(accountId.trim().toUpperCase())}/suspend`,
    {
      method: 'POST',
      body: JSON.stringify({
        reason: input.reason.trim(),
      }),
    },
  );
}

export function reactivateConnection(accountId: string): Promise<ConnectionLifecycleView> {
  return apiRequest<ConnectionLifecycleView>(
    `/technical/connections/${encodeURIComponent(accountId.trim().toUpperCase())}/reactivate`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  );
}

export function terminateConnection(
  accountId: string,
  input?: TerminateConnectionInput,
): Promise<ConnectionLifecycleView> {
  return apiRequest<ConnectionLifecycleView>(
    `/technical/connections/${encodeURIComponent(accountId.trim().toUpperCase())}/terminate`,
    {
      method: 'POST',
      body: JSON.stringify({
        note: normalizeOptionalString(input?.note),
      }),
    },
  );
}

export function searchOrders(params: OrderSearchParams): Promise<OrderView[]> {
  const search = new URLSearchParams();
  if (params.code?.trim()) {
    search.set('code', params.code.trim().toUpperCase());
  }
  if (params.customerName?.trim()) {
    search.set('customerName', params.customerName.trim());
  }
  if (params.serviceType && params.serviceType !== 'ALL') {
    search.set('serviceType', params.serviceType.trim().toUpperCase());
  }
  if (params.phone?.trim()) {
    search.set('phone', params.phone.trim());
  }
  if (params.fromDate?.trim()) {
    search.set('fromDate', params.fromDate.trim());
  }
  if (params.toDate?.trim()) {
    search.set('toDate', params.toDate.trim());
  }
  if (params.status && params.status !== 'ALL') {
    search.set('status', params.status);
  }
  const qs = search.toString();
  return apiRequest<OrderView[]>(`/orders/search${qs ? `?${qs}` : ''}`);
}

export function getDocuments(params?: DocumentQueryParams): Promise<CustomerDocumentView[]> {
  const search = new URLSearchParams();
  if (params?.year !== undefined && Number.isInteger(params.year)) {
    search.set('year', String(params.year));
  }
  if (params?.cityCode && params.cityCode !== 'ALL' && params.cityCode.trim()) {
    search.set('cityCode', params.cityCode.trim());
  }
  if (params?.customerId !== undefined && params.customerId > 0) {
    search.set('customerId', String(params.customerId));
  }
  if (params?.documentType && params.documentType !== 'ALL' && params.documentType.trim()) {
    search.set('documentType', params.documentType.trim());
  }
  const qs = search.toString();
  return apiRequest<CustomerDocumentView[]>(`/documents${qs ? `?${qs}` : ''}`);
}

export function recordDocument(input: CustomerDocumentInput): Promise<CustomerDocumentView> {
  return apiRequest<CustomerDocumentView>('/documents', {
    method: 'POST',
    body: JSON.stringify({
      customerId: input.customerId,
      documentType: input.documentType,
      title: input.title.trim(),
      filePathOrUrl: input.filePathOrUrl.trim(),
      year: input.year,
      cityCode: input.cityCode.trim(),
    }),
  });
}

export function uploadDocument(input: UploadCustomerDocumentInput): Promise<CustomerDocumentView> {
  const form = new FormData();
  form.append('customerId', String(input.customerId));
  form.append('documentType', input.documentType);
  form.append('title', input.title.trim());
  form.append('year', String(input.year));
  form.append('cityCode', input.cityCode.trim());
  form.append('file', input.file);

  return apiRequest<CustomerDocumentView>('/documents', {
    method: 'POST',
    body: form,
  });
}

export function getDocumentDownloadUrl(id: number, inline = false): string {
  return `/api/documents/${id}/download${inline ? '?inline=true' : ''}`;
}

export function getPlanChanges(params?: PlanChangeQueryParams): Promise<PlanChangeRequestView[]> {
  const search = new URLSearchParams();
  if (params?.status && params.status !== 'ALL' && params.status.trim()) {
    search.set('status', params.status.trim());
  }
  if (params?.connectionId !== undefined && params.connectionId > 0) {
    search.set('connectionId', String(params.connectionId));
  }
  const qs = search.toString();
  return apiRequest<PlanChangeRequestView[]>(`/plan-changes${qs ? `?${qs}` : ''}`);
}

export function submitPlanChange(input: PlanChangeRequestInput): Promise<PlanChangeRequestView> {
  return apiRequest<PlanChangeRequestView>('/plan-changes', {
    method: 'POST',
    body: JSON.stringify({
      connectionId: input.connectionId,
      targetPlanId: input.targetPlanId,
      note: normalizeOptionalString(input.note),
    }),
  });
}

export function approvePlanChange(id: number): Promise<PlanChangeRequestView> {
  return apiRequest<PlanChangeRequestView>(`/plan-changes/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function rejectPlanChange(
  id: number,
  input?: RejectPlanChangeInput,
): Promise<PlanChangeRequestView> {
  return apiRequest<PlanChangeRequestView>(`/plan-changes/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({
      note: normalizeOptionalString(input?.note),
    }),
  });
}
