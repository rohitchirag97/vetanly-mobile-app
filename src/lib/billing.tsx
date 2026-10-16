import { createContext, use, useCallback, useEffect, useState, type PropsWithChildren } from 'react';

import { api } from '@/lib/api';

/** See server/src/services/billing-access.services.ts for how each state is reached. */
export type Billing = {
  organizationId: string;
  state: 'inactive' | 'trial' | 'paid' | 'grace' | 'read_only' | 'unknown';
  isOwner: boolean;
  daysLeft: number;
};

type BillingContextValue = {
  /** Null while the active organization's status is loading. */
  billing: Billing | null;
  reload: () => Promise<void>;
  markTrialStarted: () => void;
};

const BillingContext = createContext<BillingContextValue | null>(null);

export function useBilling() {
  const value = use(BillingContext);
  if (!value) throw new Error('useBilling must be used inside <BillingProvider>');
  return value;
}

export function BillingProvider({ organizationId, children }: PropsWithChildren<{ organizationId: string }>) {
  const [billing, setBilling] = useState<Billing | null>(null);

  const load = useCallback(
    (id: string) =>
      api<Omit<Billing, 'organizationId'>>(`/billing/status?organizationId=${encodeURIComponent(id)}`, { auth: true }).then(
        (res) => setBilling({ organizationId: id, state: res.data.state, isOwner: res.data.isOwner, daysLeft: res.data.daysLeft }),
        // Like the web app, an error falls through to the app; the server still enforces the trial on its own.
        () => setBilling({ organizationId: id, state: 'unknown', isOwner: false, daysLeft: 0 }),
      ),
    [],
  );

  useEffect(() => {
    load(organizationId);
  }, [organizationId, load]);

  return (
    <BillingContext
      value={{
        // A status loaded for the previously selected organization never applies to the new one.
        billing: billing?.organizationId === organizationId ? billing : null,
        reload: () => load(organizationId),
        markTrialStarted: () => setBilling({ organizationId, state: 'trial', isOwner: true, daysLeft: 14 }),
      }}>
      {children}
    </BillingContext>
  );
}
