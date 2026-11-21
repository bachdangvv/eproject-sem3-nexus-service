/**
 * Customer inquiries and dynamic FAQ catalog API client (/api/queries, /api/faq).
 */
import type {
  AnswerQueryInput,
  CustomerQueryInput,
  CustomerQueryParams,
  CustomerQueryView,
  FaqItemView,
} from '../types/nexus';
import { apiRequest } from './apiClient';

export function getQueries(params?: CustomerQueryParams): Promise<CustomerQueryView[]> {
  const search = new URLSearchParams();
  if (params?.status && params.status !== 'ALL' && params.status.trim()) {
    search.set('status', params.status.trim());
  }
  if (params?.category && params.category !== 'ALL' && params.category.trim()) {
    search.set('category', params.category.trim());
  }
  if (params?.customerId !== undefined && params.customerId > 0) {
    search.set('customerId', String(params.customerId));
  }
  const qs = search.toString();
  return apiRequest<CustomerQueryView[]>(`/queries${qs ? `?${qs}` : ''}`);
}

export function createQuery(input: CustomerQueryInput): Promise<CustomerQueryView> {
  return apiRequest<CustomerQueryView>('/queries', {
    method: 'POST',
    body: JSON.stringify({
      customerId: input.customerId,
      subject: input.subject.trim(),
      category: input.category.trim(),
      question: input.question.trim(),
    }),
  });
}

export function answerQuery(id: number, input: AnswerQueryInput): Promise<CustomerQueryView> {
  return apiRequest<CustomerQueryView>(`/queries/${id}/answer`, {
    method: 'POST',
    body: JSON.stringify({
      answer: input.answer.trim(),
      isFaq: Boolean(input.isFaq),
    }),
  });
}

export function closeQuery(id: number): Promise<CustomerQueryView> {
  return apiRequest<CustomerQueryView>(`/queries/${id}/close`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function getFaqCatalog(category?: string): Promise<FaqItemView[]> {
  const search = new URLSearchParams();
  if (category && category !== 'ALL' && category.trim()) {
    search.set('category', category.trim());
  }
  const qs = search.toString();
  return apiRequest<FaqItemView[]>(`/faq${qs ? `?${qs}` : ''}`);
}
