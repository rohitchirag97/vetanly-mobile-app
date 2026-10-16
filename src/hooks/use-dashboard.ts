import { useCallback, useEffect, useState } from 'react';

import { api } from '@/lib/api';

// Field subsets of the server's responses; see client-app/src/hooks/use-payroll-api.ts for the full types.
export type AttendanceLog = {
  id: string;
  employeeId: string;
  employeeName: string;
  eventType: 'check_in' | 'check_out';
  source: 'kiosk' | 'manual';
  occurredAt: string;
};

export type LeaveRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  createdAt: string;
};

export type Holiday = { id: string; date: string; name: string };

export type Recoverable = {
  id: string;
  employeeId: string;
  status: 'pending' | 'approved' | 'disbursed' | 'active' | 'completed' | 'rejected' | 'cancelled';
  outstanding: string;
  currencyCode: string;
};

type Employee = { id: string; isActive: boolean };

export type DashboardData = {
  organizationId: string;
  employees: Employee[];
  logs: AttendanceLog[];
  leaves: LeaveRequest[];
  holidays: Holiday[];
  loans: Recoverable[];
};

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
};

/** Loads what the dashboard shows for one organization. A source that fails is shown as empty with the error. */
export function useDashboard(organizationId: string | undefined, isManager: boolean) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (id: string) => {
      const get = <T>(path: string, query = '') =>
        api<T>(`${path}?organizationId=${encodeURIComponent(id)}${query}`, { auth: true }).then((res) => res.data);
      return Promise.allSettled([
        // Only managers may list employees.
        isManager ? get<Employee[]>('/employee') : Promise.resolve([]),
        get<AttendanceLog[]>('/attendance', `&limit=100&from=${encodeURIComponent(startOfToday())}`),
        get<LeaveRequest[]>('/leave'),
        get<Holiday[]>('/holiday'),
        get<Recoverable[]>('/recoverable'),
      ]).then(([employees, logs, leaves, holidays, loans]) => {
        const value = <T>(result: PromiseSettledResult<T[]>) => (result.status === 'fulfilled' ? result.value : []);
        const failed = [employees, logs, leaves, holidays, loans].find((result) => result.status === 'rejected');
        setData({
          organizationId: id,
          employees: value(employees),
          logs: value(logs),
          leaves: value(leaves),
          holidays: value(holidays),
          loans: value(loans),
        });
        setError(failed ? (failed.reason as Error).message : null);
      });
    },
    [isManager],
  );

  useEffect(() => {
    if (organizationId) load(organizationId);
  }, [organizationId, load]);

  // Data from the previously selected organization is never shown for the new one.
  return { data: data?.organizationId === organizationId ? data : null, error, reload: () => (organizationId ? load(organizationId) : Promise.resolve()) };
}
