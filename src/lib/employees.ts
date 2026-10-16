import { api } from '@/lib/api';
import type { EmploymentInput, Lookups, Role, StatutoryInput } from '@/lib/employee-sheet';

export type Branch = { id: string; name: string; isActive: boolean; manageable: boolean };
export type EmployeeLookups = Lookups & {
  branches: Branch[];
  /** The branches a branch admin is limited to; null when they can use any. */
  limitedTo: string[] | null;
};

const withOrg = (path: string, organizationId: string) => `${path}?organizationId=${encodeURIComponent(organizationId)}`;
const get = async <T>(path: string, organizationId: string) => (await api<T>(withOrg(path, organizationId), { auth: true })).data;

/** Departments, shifts and branches to choose from; only active ones, and only branches this user may add people to. */
export async function loadLookups(organizationId: string): Promise<EmployeeLookups> {
  const active = <T extends { isActive: boolean }>(items: T[]) => items.filter((item) => item.isActive);
  const [departments, shifts, branchList] = await Promise.all([
    get<{ id: string; name: string; isActive: boolean }[]>('/department', organizationId),
    get<{ id: string; name: string; isActive: boolean }[]>('/shift', organizationId),
    get<{ branches: Branch[]; limitedTo: string[] | null }>('/branches', organizationId),
  ]);
  return {
    departments: active(departments),
    shifts: active(shifts),
    branches: active(branchList.branches).filter((branch) => branch.manageable),
    limitedTo: branchList.limitedTo,
  };
}

export type NewEmployee = { fname: string; lname: string; phone: string; role: Role; branchId?: string };

/** Returns the employee's ID and the server's message, which says when an existing member was updated instead. */
export async function createEmployee(organizationId: string, employee: NewEmployee) {
  const res = await api<{ employee?: { id?: string } }>('/employee', {
    method: 'POST',
    auth: true,
    body: { ...employee, organizationId },
  });
  return { employeeId: res.data.employee?.id, message: res.message };
}

export const saveEmployment = (organizationId: string, employeeId: string, body: Partial<EmploymentInput>) =>
  api(withOrg(`/employee/${encodeURIComponent(employeeId)}/employment`, organizationId), { method: 'PATCH', auth: true, body });

export const saveStatutory = (organizationId: string, employeeId: string, body: StatutoryInput) =>
  api(withOrg(`/statutory/employees/${encodeURIComponent(employeeId)}`, organizationId), { method: 'PUT', auth: true, body });

export type CheckStatus = 'new' | 'existing-user' | 'inactive-member' | 'member' | 'not-allowed';
export type BulkCheck = {
  phones: Record<string, { status: CheckStatus; name?: string }>;
  /** Employee codes already used in the organization, mapped to the holder's phone. */
  takenCodes: Record<string, string>;
};

/** Read-only: how each phone and employee code compares with people already in the organization. */
export const checkBulk = async (organizationId: string, phones: string[], employeeCodes: string[]) =>
  (await api<BulkCheck>('/employee/bulk/check', { method: 'POST', auth: true, body: { organizationId, phones, employeeCodes } })).data;

export type BulkResult = { row: number; phone: string; status: string; employeeId?: string };

export const bulkCreate = async (organizationId: string, employees: NewEmployee[], branchId?: string) =>
  (
    await api<{ results: BulkResult[] }>('/employee/bulk', {
      method: 'POST',
      auth: true,
      body: { organizationId, employees, ...(branchId ? { branchId } : {}) },
    })
  ).data.results;
