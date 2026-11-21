/**
 * Staff account management API client (GET/POST/PUT/DELETE /api/employees).
 */
import type { EmployeeInput, EmployeeUpdateInput, EmployeeView } from '../types/nexus';
import { apiRequest } from './apiClient';

/** Lists all staff accounts registered in the system. */
export function getEmployees(): Promise<EmployeeView[]> {
  return apiRequest<EmployeeView[]>('/employees');
}

/** Creates a new staff employee account with an initial department role and password. */
export function createEmployee(input: EmployeeInput): Promise<EmployeeView> {
  return apiRequest<EmployeeView>('/employees', {
    method: 'POST',
    body: JSON.stringify({
      username: input.username.trim(),
      displayName: input.displayName.trim(),
      role: input.role,
      password: input.password,
    }),
  });
}

/** Updates an existing staff account's display name, role, optional password, or active status. */
export function updateEmployee(id: number, input: EmployeeUpdateInput): Promise<EmployeeView> {
  return apiRequest<EmployeeView>(`/employees/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      displayName: input.displayName.trim(),
      role: input.role,
      password: input.password && input.password.trim().length > 0 ? input.password : null,
      active: input.active,
      retailShopId: input.retailShopId,
    }),
  });
}

/** Soft-deactivates a staff account so the employee can no longer sign in. */
export function deactivateEmployee(id: number): Promise<EmployeeView> {
  return apiRequest<EmployeeView>(`/employees/${id}`, {
    method: 'DELETE',
  });
}
