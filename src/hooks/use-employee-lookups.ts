import { useEffect, useState } from 'react';

import { loadLookups, type EmployeeLookups } from '@/lib/employees';

/** Departments, shifts and branches for the employee forms. The forms still work if these fail to load. */
export function useEmployeeLookups(organizationId: string | undefined) {
  const [state, setState] = useState<{ organizationId: string; lookups: EmployeeLookups | null; error: string | null } | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    loadLookups(organizationId).then(
      (lookups) => setState({ organizationId, lookups, error: null }),
      (err: Error) => setState({ organizationId, lookups: null, error: err.message }),
    );
  }, [organizationId]);

  const current = state?.organizationId === organizationId ? state : null;
  return { lookups: current?.lookups ?? null, error: current?.error ?? null, loading: !current };
}
