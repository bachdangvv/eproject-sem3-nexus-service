import type {
  ConnectOrderInput,
  EquipmentIncidentInput,
  EquipmentIncidentView,
  EquipmentStockView,
  OrderView,
  PurchaseOrderInput,
  PurchaseOrderView,
  RetailShopInput,
  RetailShopView,
  VendorInput,
  VendorPaymentInput,
  VendorPaymentView,
  VendorView,
} from '../types/nexus';
import { apiRequest, normalizeOptionalString } from './apiClient';

// ==================== Retail Shops ====================

export function getRetailShops(cityCode?: string): Promise<RetailShopView[]> {
  const query = cityCode ? `?cityCode=${encodeURIComponent(cityCode)}` : '';
  return apiRequest<RetailShopView[]>(`/retail-shops${query}`);
}

export function getAdminRetailShops(cityCode?: string): Promise<RetailShopView[]> {
  const query = cityCode ? `?cityCode=${encodeURIComponent(cityCode)}` : '';
  return apiRequest<RetailShopView[]>(`/admin/retail-shops${query}`);
}

export function createRetailShop(input: RetailShopInput): Promise<RetailShopView> {
  return apiRequest<RetailShopView>('/admin/retail-shops', {
    method: 'POST',
    body: JSON.stringify({
      code: input.code.trim(),
      name: input.name.trim(),
      cityCode: input.cityCode.trim(),
      address: input.address.trim(),
      phone: input.phone.trim(),
      active: input.active ?? true,
    }),
  });
}

export function updateRetailShop(id: number, input: RetailShopInput): Promise<RetailShopView> {
  return apiRequest<RetailShopView>(`/admin/retail-shops/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      code: input.code.trim(),
      name: input.name.trim(),
      cityCode: input.cityCode.trim(),
      address: input.address.trim(),
      phone: input.phone.trim(),
      active: input.active ?? true,
    }),
  });
}

export function deleteRetailShop(id: number): Promise<void> {
  return apiRequest<void>(`/admin/retail-shops/${id}`, { method: 'DELETE' });
}

// ==================== Vendors ====================

export function getVendors(): Promise<VendorView[]> {
  return apiRequest<VendorView[]>('/admin/vendors');
}

export function createVendor(input: VendorInput): Promise<VendorView> {
  return apiRequest<VendorView>('/admin/vendors', {
    method: 'POST',
    body: JSON.stringify({
      code: input.code.trim(),
      name: input.name.trim(),
      contactPerson: input.contactPerson.trim(),
      phone: input.phone.trim(),
      email: input.email.trim(),
      address: input.address.trim(),
      active: input.active ?? true,
    }),
  });
}

export function updateVendor(id: number, input: VendorInput): Promise<VendorView> {
  return apiRequest<VendorView>(`/admin/vendors/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      code: input.code.trim(),
      name: input.name.trim(),
      contactPerson: input.contactPerson.trim(),
      phone: input.phone.trim(),
      email: input.email.trim(),
      address: input.address.trim(),
      active: input.active ?? true,
    }),
  });
}

export function deleteVendor(id: number): Promise<void> {
  return apiRequest<void>(`/admin/vendors/${id}`, { method: 'DELETE' });
}

// ==================== Purchase Orders ====================

export function getPurchases(status?: string): Promise<PurchaseOrderView[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiRequest<PurchaseOrderView[]>(`/admin/purchases${query}`);
}

export function createPurchase(input: PurchaseOrderInput): Promise<PurchaseOrderView> {
  return apiRequest<PurchaseOrderView>('/admin/purchases', {
    method: 'POST',
    body: JSON.stringify({
      vendorId: input.vendorId,
      productId: input.productId,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      note: normalizeOptionalString(input.note),
    }),
  });
}

export function receivePurchase(id: number): Promise<PurchaseOrderView> {
  return apiRequest<PurchaseOrderView>(`/admin/purchases/${id}/receive`, {
    method: 'POST',
  });
}

export function cancelPurchase(id: number): Promise<PurchaseOrderView> {
  return apiRequest<PurchaseOrderView>(`/admin/purchases/${id}/cancel`, {
    method: 'POST',
  });
}

// ==================== Vendor Payments ====================

export function getVendorPayments(purchaseOrderId?: number): Promise<VendorPaymentView[]> {
  const query = purchaseOrderId ? `?purchaseOrderId=${purchaseOrderId}` : '';
  return apiRequest<VendorPaymentView[]>(`/admin/vendor-payments${query}`);
}

export function createVendorPayment(input: VendorPaymentInput): Promise<VendorPaymentView> {
  return apiRequest<VendorPaymentView>('/admin/vendor-payments', {
    method: 'POST',
    body: JSON.stringify({
      purchaseOrderId: input.purchaseOrderId,
      amount: input.amount,
      method: input.method,
      reference: normalizeOptionalString(input.reference),
      note: normalizeOptionalString(input.note),
    }),
  });
}

// ==================== Technical Equipment & Incidents ====================

export function getTechnicalEquipment(): Promise<EquipmentStockView[]> {
  return apiRequest<EquipmentStockView[]>('/technical/equipment');
}

export function getEquipmentIncidents(settled?: boolean): Promise<EquipmentIncidentView[]> {
  const query = settled !== undefined ? `?settled=${settled}` : '';
  return apiRequest<EquipmentIncidentView[]>(`/technical/incidents${query}`);
}

export function recordEquipmentIncident(input: EquipmentIncidentInput): Promise<EquipmentIncidentView> {
  return apiRequest<EquipmentIncidentView>('/technical/incidents', {
    method: 'POST',
    body: JSON.stringify({
      connectionId: input.connectionId ?? null,
      accountId: normalizeOptionalString(input.accountId),
      productId: input.productId,
      description: input.description.trim(),
      replacementFee: input.replacementFee ?? 0,
    }),
  });
}

export function connectOrderWithEquipment(code: string, input?: ConnectOrderInput): Promise<OrderView> {
  return apiRequest<OrderView>(`/orders/${code}/connection`, {
    method: 'POST',
    body: input?.productId ? JSON.stringify({ productId: input.productId }) : undefined,
  });
}
