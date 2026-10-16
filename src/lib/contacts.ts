import { Linking, Platform } from 'react-native';

import { loadNative } from '@/lib/native';
import { normalizePhone, splitName } from '@/lib/phone';

const loadContactsModule = async () => {
  if (Platform.OS === 'web') throw new Error('Contacts are only available in the mobile app.');
  return loadNative(() => import('expo-contacts'), 'Adding from contacts');
};

type ContactsModule = Awaited<ReturnType<typeof loadContactsModule>>;
const fields = (m: ContactsModule) => [m.ContactField.GIVEN_NAME, m.ContactField.FAMILY_NAME, m.ContactField.FULL_NAME, m.ContactField.PHONES] as const;

export type ContactPerson = {
  id: string;
  name: string;
  fname: string;
  lname: string;
  /** Normalized (digits with country code); null when none of the contact's numbers is usable. */
  phone: string | null;
};

type Details = {
  id: string;
  givenName?: string | null;
  familyName?: string | null;
  fullName?: string | null;
  phones?: { label?: string; number?: string }[] | null;
};

// A contact can hold several numbers; prefer the one labelled mobile, then the first usable one.
const bestPhone = (phones: Details['phones']) => {
  const candidates = [...(phones ?? [])].sort((a, b) => Number(/mobile|cell/i.test(b.label ?? '')) - Number(/mobile|cell/i.test(a.label ?? '')));
  for (const candidate of candidates) {
    const phone = candidate.number ? normalizePhone(candidate.number) : null;
    if (phone) return phone;
  }
  return null;
};

const toPerson = (details: Details): ContactPerson => {
  const { fname, lname } = splitName(details.givenName, details.familyName, details.fullName);
  const name = `${fname} ${lname}`.trim() || details.fullName?.trim() || 'No name';
  return { id: details.id, name, fname, lname, phone: bestPhone(details.phones) };
};

export class ContactsDeniedError extends Error {
  constructor(public canAskAgain: boolean) {
    super(
      canAskAgain
        ? 'Vetanly needs access to your contacts to add people from them.'
        : 'Contacts access is turned off for Vetanly. Turn it on in Settings to add people from your contacts.',
    );
  }
}

export const openAppSettings = () => Linking.openSettings();

/** Asks for read access (a no-op once granted); throws ContactsDeniedError when refused. */
async function ensureAccess(m: ContactsModule) {
  const permission = await m.requestPermissionsAsync();
  if (!permission.granted) throw new ContactsDeniedError(permission.canAskAgain);
}

/** Everyone in the address book that has a phone number, sorted by name. Asks for access first. */
export async function loadContacts(): Promise<ContactPerson[]> {
  const m = await loadContactsModule();
  await ensureAccess(m);
  const all = (await m.Contact.getAllDetails(fields(m), { sortOrder: m.ContactsSortOrder.GivenName })) as Details[];
  return all.filter((item) => item.phones?.length).map(toPerson);
}

/** Opens the system contact picker for one person; null when the user backs out. */
export async function pickOneContact(): Promise<ContactPerson | null> {
  const m = await loadContactsModule();
  // The picker itself needs no permission, but reading the chosen contact's name and numbers does (Android).
  await ensureAccess(m);
  const contact = await m.Contact.presentPicker();
  if (!contact) return null;
  const details = (await contact.getDetails(fields(m))) as Details;
  return toPerson({ ...details, id: details.id ?? contact.id });
}
