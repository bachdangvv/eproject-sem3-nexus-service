import type {
  CityInput,
  CityView,
  PlanInput,
  PlanView,
  ProductInput,
  ProductView,
} from '../types/nexus';
import { apiRequest, normalizeOptionalString } from './apiClient';

export function getCities(): Promise<CityView[]> {
  return apiRequest<CityView[]>('/cities');
}

export function createCity(input: CityInput): Promise<CityView> {
  return apiRequest<CityView>('/cities', {
    method: 'POST',
    body: JSON.stringify({
      code: input.code.trim(),
      name: input.name.trim(),
    }),
  });
}

export function getPlans(): Promise<PlanView[]> {
  return apiRequest<PlanView[]>('/plans');
}

export function createPlan(input: PlanInput): Promise<PlanView> {
  return apiRequest<PlanView>('/plans', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name.trim(),
      type: input.type,
      description: normalizeOptionalString(input.description),
      price: input.price,
      active: input.active,
    }),
  });
}

export function updatePlan(id: number, input: PlanInput): Promise<PlanView> {
  return apiRequest<PlanView>(`/plans/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: input.name.trim(),
      type: input.type,
      description: normalizeOptionalString(input.description),
      price: input.price,
      active: input.active,
    }),
  });
}

export function archivePlan(id: number): Promise<void> {
  return apiRequest<void>(`/plans/${id}`, { method: 'DELETE' });
}

export function getProducts(): Promise<ProductView[]> {
  return apiRequest<ProductView[]>('/products');
}

export function createProduct(input: ProductInput): Promise<ProductView> {
  return apiRequest<ProductView>('/products', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name.trim(),
      description: normalizeOptionalString(input.description),
      active: input.active,
    }),
  });
}

export function updateProduct(id: number, input: ProductInput): Promise<ProductView> {
  return apiRequest<ProductView>(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: input.name.trim(),
      description: normalizeOptionalString(input.description),
      active: input.active,
    }),
  });
}

export function archiveProduct(id: number): Promise<void> {
  return apiRequest<void>(`/products/${id}`, { method: 'DELETE' });
}
