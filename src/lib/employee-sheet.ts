import * as XLSX from 'xlsx';

// A port of client-app/src/lib/employee-excel.ts: same sheet, headers and rules, so a template filled in for the web
// imports the same way here. Keep the two in step. SheetJS replaces exceljs, which needs Node APIs React Native lacks.

export type Role = 'employee' | 'hr' | 'admin';

export type EmploymentInput = {
  employeeCode: string;
  jobTitle: string;
  departmentId: string;
  shiftId: string;
  branchId: string;
  employmentType: 'full_time' | 'part_time' | 'contractor' | 'intern';
  hireDate: string;
  compensationType: 'hourly' | 'daily' | 'fixed_salary';
  compensationAmount: number;
  compensationCurrency: string;
  payFrequency: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
};

export type StatutoryInput = {
  uan: string;
  esiNumber: string;
  pan?: string;
  gender: 'male' | 'female' | 'other' | '';
  pfApplicable: boolean;
  esiApplicable: boolean;
  taxRegime: 'new' | 'old';
  declaredDeductions: number;
};

export type SheetRow = {
  row: number;
  fname: string;
  lname: string;
  phone: string;
  role: Role;
  employment: Partial<EmploymentInput>;
  statutory: StatutoryInput | null;
  error?: string;
};

export type Lookups = {
  departments: { id: string; name: string }[];
  shifts: { id: string; name: string }[];
};

const SHEET_NAME = 'Employees';
export const MAX_ROWS = 500;

const OPTIONS = {
  employmentType: { 'full time': 'full_time', 'part time': 'part_time', contractor: 'contractor', intern: 'intern' },
  compensationType: { hourly: 'hourly', daily: 'daily', 'fixed salary': 'fixed_salary' },
  payFrequency: { weekly: 'weekly', 'every two weeks': 'biweekly', 'twice a month': 'semimonthly', monthly: 'monthly' },
  gender: { male: 'male', female: 'female', other: 'other' },
  taxRegime: { new: 'new', old: 'old' },
  yesNo: { yes: true, no: false },
} as const;

type Column = { header: string; required?: boolean; example: string; help: string };

const COLUMNS: Column[] = [
  { header: 'First Name', required: true, example: 'Asha', help: 'Required.' },
  { header: 'Last Name', required: true, example: 'Sharma', help: 'Required.' },
  { header: 'Country Code', required: true, example: '91', help: 'Digits only. Blank = 91.' },
  { header: 'Phone Number', required: true, example: '9876543210', help: '10-digit mobile number, without country code.' },
  { header: 'Role', example: 'Employee', help: 'Employee, HR or Admin. Blank = Employee.' },
  { header: 'Employee Code', example: 'EMP001', help: 'Optional, up to 32 characters.' },
  { header: 'Job Title', example: 'Sales Executive', help: 'Optional.' },
  { header: 'Department', example: '', help: 'A department name from the Lists sheet.' },
  { header: 'Shift', example: '', help: 'A shift name from the Lists sheet.' },
  { header: 'Employment Type', example: 'Full Time', help: 'Full Time, Part Time, Contractor or Intern.' },
  { header: 'Hire Date', example: '2026-04-01', help: 'Format YYYY-MM-DD.' },
  { header: 'Compensation Type', example: 'Fixed Salary', help: 'Hourly, Daily or Fixed Salary.' },
  { header: 'Compensation Amount', example: '25000', help: 'Amount per hour, day or pay period depending on type.' },
  { header: 'Currency', example: 'INR', help: '3-letter code, e.g. INR.' },
  { header: 'Pay Frequency', example: 'Monthly', help: 'Weekly, Every Two Weeks, Twice A Month or Monthly.' },
  { header: 'Gender', example: 'Female', help: 'Male, Female or Other.' },
  { header: 'PAN', example: 'ABCDE1234F', help: 'Format ABCDE1234F.' },
  { header: 'UAN', example: '', help: '12 digits.' },
  { header: 'ESI Number', example: '', help: '10 to 17 digits.' },
  { header: 'Tax Regime', example: 'New', help: 'New or Old. Blank = New.' },
  { header: 'PF Applicable', example: 'Yes', help: 'Yes or No. Blank = Yes.' },
  { header: 'ESI Applicable', example: 'Yes', help: 'Yes or No. Blank = Yes.' },
];

const cellText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    // SheetJS reads date cells as local midnight; build the key from local parts so the day doesn't shift.
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  return String(value).trim();
};

const pick = <T>(map: Record<string, T>, value: string): T | undefined => map[value.trim().toLowerCase()];

/** A blank template as .xlsx bytes, with the organization's department and shift names on a Lists sheet. */
export function buildTemplate(lookups: Lookups): Uint8Array {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([COLUMNS.map((c) => c.header), COLUMNS.map((c) => c.example)]);
  sheet['!cols'] = COLUMNS.map((c) => ({ wch: Math.max(14, c.header.length + 4) }));
  XLSX.utils.book_append_sheet(workbook, sheet, SHEET_NAME);

  const longest = Math.max(lookups.departments.length, lookups.shifts.length);
  const lists = XLSX.utils.aoa_to_sheet([
    ['Departments', 'Shifts'],
    ...Array.from({ length: longest }, (_, i) => [lookups.departments[i]?.name ?? '', lookups.shifts[i]?.name ?? '']),
  ]);
  lists['!cols'] = [{ wch: 28 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(workbook, lists, 'Lists');

  const help = XLSX.utils.aoa_to_sheet([
    ['How to fill the Employees sheet'],
    [`One employee per row (max ${MAX_ROWS}). Columns marked * are required. Row 2 is an example; overwrite or delete it. Do not rename the sheet or headers.`],
    [],
    ['Column', 'Notes'],
    ...COLUMNS.map((c) => [c.header + (c.required ? ' *' : ''), c.help]),
  ]);
  help['!cols'] = [{ wch: 26 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(workbook, help, 'Instructions');

  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as Uint8Array;
}

/** Reads every employee row and checks it locally; a row with problems carries them in `error` and is not imported. */
export function parseSheet(bytes: Uint8Array, allowElevatedRoles: boolean, lookups: Lookups): SheetRow[] {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(bytes, { type: 'array', cellDates: true });
  } catch {
    throw new Error('This file could not be read. Upload the .xlsx template, or a .csv with the same headers.');
  }
  const sheet = workbook.Sheets[SHEET_NAME] ?? workbook.Sheets[workbook.SheetNames[0] ?? ''];
  if (!sheet) throw new Error('The file has no sheets.');

  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '', blankrows: true });
  const headerIndex = new Map<string, number>();
  (grid[0] ?? []).forEach((cell, i) => headerIndex.set(cellText(cell).toLowerCase(), i));
  const missing = COLUMNS.filter((c) => c.required && !headerIndex.has(c.header.toLowerCase()));
  if (missing.length > 0) {
    throw new Error(`Missing column: ${missing.map((c) => c.header).join(', ')}. Use the template and keep its headers.`);
  }

  const byName = (items: { id: string; name: string }[]) =>
    Object.fromEntries(items.map((item) => [item.name.trim().toLowerCase(), item.id]));
  const departmentIds = byName(lookups.departments);
  const shiftIds = byName(lookups.shifts);

  const rows: SheetRow[] = [];
  const seen = new Set<string>();
  const seenCodes = new Set<string>();

  grid.slice(1).forEach((cells, i) => {
    const rowNumber = i + 2;
    const get = (header: string) => {
      const col = headerIndex.get(header.toLowerCase());
      return col === undefined ? '' : cellText(cells[col]);
    };
    if (COLUMNS.every((c) => !get(c.header))) return;

    const fname = get('First Name');
    const lname = get('Last Name');
    const digits = get('Phone Number').replace(/\D/g, '');
    const countryCode = get('Country Code').replace(/\D/g, '') || '91';
    const phone = `${countryCode}${digits}`;
    const role = pick<Role>({ employee: 'employee', hr: 'hr', admin: 'admin' }, get('Role') || 'employee');

    const errors: string[] = [];
    if (!fname || !lname) errors.push('First and last name are required');
    if (digits.length !== 10) errors.push('Phone number must be 10 digits');
    else if (!/^\d{11,15}$/.test(phone)) errors.push('Invalid country code or phone');
    if (!role) errors.push('Role must be Employee, HR or Admin');
    else if (role !== 'employee' && !allowElevatedRoles) errors.push('You can only add employees');
    if (seen.has(phone)) errors.push('Duplicate phone number in this file');
    seen.add(phone);

    const employment: Partial<EmploymentInput> = {};
    const code = get('Employee Code');
    if (code) {
      if (code.length > 32) errors.push('Employee code is too long');
      else if (seenCodes.has(code.toLowerCase())) errors.push(`Employee code "${code}" is repeated in this file`);
      else employment.employeeCode = code;
      seenCodes.add(code.toLowerCase());
    }
    const title = get('Job Title');
    if (title) employment.jobTitle = title.slice(0, 100);

    const department = get('Department');
    if (department) {
      const id = departmentIds[department.toLowerCase()];
      if (id) employment.departmentId = id;
      else errors.push(`Unknown department "${department}"`);
    }
    const shift = get('Shift');
    if (shift) {
      const id = shiftIds[shift.toLowerCase()];
      if (id) employment.shiftId = id;
      else errors.push(`Unknown shift "${shift}"`);
    }

    const choice = <K extends keyof EmploymentInput>(header: string, key: K, map: Record<string, string>) => {
      const value = get(header);
      if (!value) return;
      const found = pick(map, value);
      if (found) employment[key] = found as EmploymentInput[K];
      else errors.push(`Invalid ${header}`);
    };
    choice('Employment Type', 'employmentType', OPTIONS.employmentType);
    choice('Compensation Type', 'compensationType', OPTIONS.compensationType);
    choice('Pay Frequency', 'payFrequency', OPTIONS.payFrequency);

    const hire = get('Hire Date');
    if (hire) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(hire) && !Number.isNaN(Date.parse(hire))) employment.hireDate = hire;
      else errors.push('Hire Date must be YYYY-MM-DD');
    }
    const amount = get('Compensation Amount');
    if (amount) {
      const value = Number(amount.replace(/,/g, ''));
      if (Number.isFinite(value) && value >= 0) employment.compensationAmount = value;
      else errors.push('Compensation Amount must be a number');
    }
    const currency = get('Currency');
    if (currency) {
      if (/^[A-Za-z]{3}$/.test(currency)) employment.compensationCurrency = currency.toUpperCase();
      else errors.push('Currency must be a 3-letter code');
    }

    const pan = get('PAN').toUpperCase();
    const uan = get('UAN');
    const esi = get('ESI Number');
    const gender = get('Gender');
    const regime = get('Tax Regime');
    const pf = get('PF Applicable');
    const esiApplicable = get('ESI Applicable');
    if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) errors.push('PAN looks like ABCDE1234F');
    if (uan && !/^\d{12}$/.test(uan)) errors.push('UAN must be 12 digits');
    if (esi && !/^\d{10,17}$/.test(esi)) errors.push('ESI Number must be 10 to 17 digits');
    const genderValue = gender ? pick<string>(OPTIONS.gender, gender) : '';
    if (gender && !genderValue) errors.push('Invalid Gender');
    const regimeValue = regime ? pick<string>(OPTIONS.taxRegime, regime) : 'new';
    if (regime && !regimeValue) errors.push('Invalid Tax Regime');
    const pfValue = pf ? pick<boolean>(OPTIONS.yesNo, pf) : true;
    const esiFlag = esiApplicable ? pick<boolean>(OPTIONS.yesNo, esiApplicable) : true;
    if (pf && pfValue === undefined) errors.push('PF Applicable must be Yes or No');
    if (esiApplicable && esiFlag === undefined) errors.push('ESI Applicable must be Yes or No');

    const hasStatutory = Boolean(pan || uan || esi || gender || regime || pf || esiApplicable);
    rows.push({
      row: rowNumber,
      fname,
      lname,
      phone,
      role: role ?? 'employee',
      employment,
      statutory: hasStatutory
        ? {
            uan,
            esiNumber: esi,
            gender: (genderValue ?? '') as StatutoryInput['gender'],
            pfApplicable: pfValue ?? true,
            esiApplicable: esiFlag ?? true,
            taxRegime: (regimeValue ?? 'new') as StatutoryInput['taxRegime'],
            declaredDeductions: 0,
            ...(pan ? { pan } : {}),
          }
        : null,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    });
  });

  if (rows.length === 0) throw new Error('No employee rows found in the file.');
  if (rows.length > MAX_ROWS) throw new Error(`A file can contain at most ${MAX_ROWS} employees.`);
  return rows;
}
