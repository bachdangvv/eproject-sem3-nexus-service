import type {
  AssessmentInput,
  CreatedFeedbackView,
  CustomerInput,
  CustomerView,
  FeedbackInput,
  OrderDetailView,
  OrderQueryParams,
  OrderView,
  RequestInput,
  RequestView,
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

export function connectOrder(code: string): Promise<OrderView> {
  return apiRequest<OrderView>(
    `/orders/${encodeURIComponent(code.trim().toUpperCase())}/connection`,
    {
      method: 'POST',
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
