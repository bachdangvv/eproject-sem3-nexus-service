import type { EmployeeInput, EmployeeView } from '../types/nexus';
import { apiRequest } from './apiClient';

export function getEmployees(): Promise<EmployeeView[]> {
  return apiRequest<EmployeeView[]>('/employees');
}

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
