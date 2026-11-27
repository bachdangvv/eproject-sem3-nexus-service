/**
 * Customer self-service portal API client (/api/customer/*) covering profile,
 * requests, orders, feedback, connections, online billing payments, plan changes, and queries.
 */
import type {
  BillingView,
  ConnectionLifecycleView,
  CreatedFeedbackView,
  CustomerPaymentInput,
  CustomerProfileInput,
  CustomerProfileView,
  CustomerQueryView,
  CustomerRequestInput,
  CustomerSelfQueryInput,
  FeedbackInput,
  OrderDetailView,
  OrderView,
  PlanChangeRequestInput,
  PlanChangeRequestView,
  RequestView,
} from '../types/nexus';
import { apiRequest, normalizeOptionalString } from './apiClient';
import { getSession } from './authApi';
import { withPaymentOperation } from './paymentRetry';

export function getProfile(): Promise<CustomerProfileView> {
  return apiRequest<CustomerProfileView>('/customer/profile');
}

export function updateProfile(input: CustomerProfileInput): Promise<CustomerProfileView> {
  return apiRequest<CustomerProfileView>('/customer/profile', {
    method: 'PUT',
    body: JSON.stringify({
      name: input.name.trim(),
      phone: input.phone.trim(),
      address: input.address.trim(),
      cityCode: input.cityCode.trim(),
      email: normalizeOptionalString(input.email),
      contactPerson: normalizeOptionalString(input.contactPerson),
      taxId: normalizeOptionalString(input.taxId),
      customerType: normalizeOptionalString(input.customerType),
    }),
  });
}

export function getRequests(): Promise<RequestView[]> {
  return apiRequest<RequestView[]>('/customer/requests');
}

export function createRequest(input: CustomerRequestInput): Promise<RequestView> {
  return apiRequest<RequestView>('/customer/requests', {
    method: 'POST',
    body: JSON.stringify({
      planId: input.planId,
      hasNexusLandline: Boolean(input.hasNexusLandline),
      connectionCount: input.connectionCount ?? 1,
      address: normalizeOptionalString(input.address),
      cityCode: normalizeOptionalString(input.cityCode),
    }),
  });
}

export function getOrders(): Promise<OrderView[]> {
  return apiRequest<OrderView[]>('/customer/orders');
}

export function getOrderDetail(code: string): Promise<OrderDetailView> {
  return apiRequest<OrderDetailView>(
    `/customer/orders/${encodeURIComponent(code.trim().toUpperCase())}`,
  );
}

export function submitFeedback(
  code: string,
  input: FeedbackInput,
): Promise<CreatedFeedbackView> {
  return apiRequest<CreatedFeedbackView>(
    `/customer/orders/${encodeURIComponent(code.trim().toUpperCase())}/feedback`,
    {
      method: 'POST',
      body: JSON.stringify({
        rating: input.rating,
        comment: input.comment.trim(),
      }),
    },
  );
}

export function getConnections(): Promise<ConnectionLifecycleView[]> {
  return apiRequest<ConnectionLifecycleView[]>('/customer/connections');
}

export function getBilling(): Promise<BillingView[]> {
  return apiRequest<BillingView[]>('/customer/billing');
}

export async function payBillingOnline(
  accountId: string,
  input?: CustomerPaymentInput,
): Promise<BillingView> {
  const path = `/customer/billing/${encodeURIComponent(accountId.trim().toUpperCase())}/payments`;
  const session = await getSession();
  return withPaymentOperation(`${session.username}:${path}`, input, body =>
    apiRequest<BillingView>(path, { method: 'POST', body: JSON.stringify(body) }));
}

export function getPlanChanges(): Promise<PlanChangeRequestView[]> {
  return apiRequest<PlanChangeRequestView[]>('/customer/plan-changes');
}

export function createPlanChange(
  input: PlanChangeRequestInput,
): Promise<PlanChangeRequestView> {
  return apiRequest<PlanChangeRequestView>('/customer/plan-changes', {
    method: 'POST',
    body: JSON.stringify({
      connectionId: input.connectionId,
      targetPlanId: input.targetPlanId,
      note: normalizeOptionalString(input.note),
    }),
  });
}

export function getQueries(): Promise<CustomerQueryView[]> {
  return apiRequest<CustomerQueryView[]>('/customer/queries');
}

export function createQuery(input: CustomerSelfQueryInput): Promise<CustomerQueryView> {
  return apiRequest<CustomerQueryView>('/customer/queries', {
    method: 'POST',
    body: JSON.stringify({
      subject: input.subject.trim(),
      category: input.category,
      question: input.question.trim(),
    }),
  });
}
