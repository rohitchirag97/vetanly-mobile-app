import { createContext, use, useCallback, useEffect, useState, type PropsWithChildren } from 'react';

import { api, setOnSessionExpired, setTokens } from '@/lib/api';
import { googleSignOut } from '@/lib/google';
import { getItem, removeItem, setItem } from '@/lib/storage';

export type User = {
  id: string;
  fname: string;
  lname: string;
  phone: string;
  email?: string | null;
  phoneVerified?: boolean;
  emailVerified?: boolean;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  membershipActive: boolean;
  status?: 'active' | 'suspended' | 'pending_deletion' | 'deleted';
  role?: 'super_admin' | 'admin' | 'hr' | 'employee';
  /** An admin or HR limited to some branches: no finance or organization-wide settings. */
  branchLimited?: boolean;
};

export const isSelectableOrganization = (organization: Organization) =>
  organization.isActive && organization.membershipActive && (organization.status ?? 'active') === 'active';

// Same rules as client-app/src/lib/session.ts.
const hasRole = (organization: Organization | undefined, roles: Organization['role'][]) =>
  Boolean(organization?.role && roles.includes(organization.role));
/** The owner: billing and organization settings. */
export const isOwner = (organization?: Organization) => hasRole(organization, ['super_admin']);
/** Owner or organization-wide admin: payroll, loans and settings. A branch-limited admin manages people only. */
export const canManage = (organization?: Organization) =>
  hasRole(organization, ['super_admin', 'admin']) && !organization?.branchLimited;
/** Owner, admin or HR: people, attendance and leave across the organization. */
export const isPeopleManager = (organization?: Organization) => hasRole(organization, ['super_admin', 'admin', 'hr']);

/** What /auth/verify-otp and /auth/google return. */
export type AuthResult = {
  user: User;
  userOrganizations: Organization[];
  accessToken: string;
  refreshToken: string;
};

// Accounts created through Google hold a "g…" placeholder until a real phone is linked.
export const displayPhone = (user: Pick<User, 'phone'>) => (user.phone.startsWith('g') ? null : `+${user.phone}`);

// shortcut: organizations live in SecureStore, which warns above ~2KB per value; move them to AsyncStorage if users belong to many orgs.
const KEYS = ['accessToken', 'refreshToken', 'user', 'organizations'] as const;
const ACTIVE_ORGANIZATION_KEY = 'activeOrganizationId';

const clearStoredSession = () => Promise.all([...KEYS, ACTIVE_ORGANIZATION_KEY].map(removeItem));

type SessionContextValue = {
  user: User | null;
  /** The user's organizations as last seen; empty means they must create one before anything else. */
  organizations: Organization[];
  /** The organization the app is showing: the one last picked in the switcher, else the first usable one. */
  activeOrganization: Organization | undefined;
  selectOrganization: (organizationId: string) => void;
  isLoading: boolean;
  signIn: (result: AuthResult) => Promise<void>;
  signOut: () => Promise<void>;
  /** Reloads the user and organizations from the server. */
  refresh: () => Promise<void>;
  /** Stores the user after a profile change. */
  updateUser: (user: User) => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession() {
  const value = use(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeOrganization =
    organizations.find((item) => item.id === selectedId && isSelectableOrganization(item)) ??
    organizations.find(isSelectableOrganization);

  const selectOrganization = (organizationId: string) => {
    setSelectedId(organizationId);
    void setItem(ACTIVE_ORGANIZATION_KEY, organizationId);
  };

  const saveProfile = useCallback((nextUser: User, nextOrganizations: Organization[]) => {
    setUser(nextUser);
    setOrganizations(nextOrganizations);
    return Promise.all([
      setItem('user', JSON.stringify(nextUser)),
      setItem('organizations', JSON.stringify(nextOrganizations)),
    ]);
  }, []);

  const refresh = useCallback(async () => {
    const res = await api<{ user: User; userOrganizations: Organization[] }>('/auth/me', { auth: true });
    await saveProfile(res.data.user, res.data.userOrganizations);
  }, [saveProfile]);

  useEffect(() => {
    setOnSessionExpired(() => {
      setUser(null);
      setOrganizations([]);
      setSelectedId(null);
      void clearStoredSession();
    });
    (async () => {
      try {
        const [accessToken, refreshToken, storedUser, storedOrganizations] = await Promise.all(KEYS.map(getItem));
        if (accessToken && refreshToken && storedUser && storedOrganizations) {
          setTokens({ accessToken, refreshToken });
          setUser(JSON.parse(storedUser) as User);
          setOrganizations(JSON.parse(storedOrganizations) as Organization[]);
          setSelectedId(await getItem(ACTIVE_ORGANIZATION_KEY));
          // Opens with the stored copy, then picks up organizations joined or created elsewhere since.
          refresh().catch(() => {});
        }
      } catch {
        // Unreadable storage (e.g. after a Keychain reset) just means signing in again.
        await clearStoredSession().catch(() => {});
      } finally {
        setIsLoading(false);
      }
    })();
  }, [refresh]);

  const signIn = async ({ user: nextUser, userOrganizations, accessToken, refreshToken }: AuthResult) => {
    await Promise.all([setItem('accessToken', accessToken), setItem('refreshToken', refreshToken)]);
    setTokens({ accessToken, refreshToken });
    await saveProfile(nextUser, userOrganizations);
  };

  const updateUser = async (nextUser: User) => {
    await saveProfile(nextUser, organizations);
  };

  const signOut = async () => {
    // The local session is cleared even if the server or Google can't be reached.
    await api('/auth/logout', { method: 'POST', auth: true }).catch(() => {});
    await googleSignOut();
    setTokens(null);
    await clearStoredSession();
    setUser(null);
    setOrganizations([]);
    setSelectedId(null);
  };

  return (
    <SessionContext value={{ user, organizations, activeOrganization, selectOrganization, isLoading, signIn, signOut, refresh, updateUser }}>{children}</SessionContext>
  );
}
