// Run with: bun test src/lib
import { describe, expect, test } from 'bun:test';
import * as XLSX from 'xlsx';

import { buildTemplate, parseSheet } from './employee-sheet';

const lookups = { departments: [{ id: 'd1', name: 'Sales' }], shifts: [{ id: 's1', name: 'Morning' }] };

const sheetBytes = (rows: unknown[][]) => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Employees');
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as Uint8Array;
};

const HEADERS = ['First Name', 'Last Name', 'Country Code', 'Phone Number', 'Role', 'Department', 'Hire Date', 'PAN'];

describe('employee sheet', () => {
  test('the template round-trips: its example row parses cleanly', () => {
    const rows = parseSheet(buildTemplate(lookups), true, lookups);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ row: 2, fname: 'Asha', lname: 'Sharma', phone: '919876543210', role: 'employee' });
    expect(rows[0]?.error).toBeUndefined();
    expect(rows[0]?.employment).toMatchObject({ employeeCode: 'EMP001', employmentType: 'full_time', hireDate: '2026-04-01', compensationAmount: 25000 });
    expect(rows[0]?.statutory).toMatchObject({ pan: 'ABCDE1234F', pfApplicable: true, taxRegime: 'new' });
  });

  test('numeric phone cells, lookups and blank rows', () => {
    const rows = parseSheet(
      sheetBytes([HEADERS, ['Ravi', 'Kumar', 91, 9123456789, '', 'sales', '', ''], [], ['Meena', 'Rao', '', '9000000001', 'HR', '', '', '']]),
      true,
      lookups,
    );
    expect(rows.map((r) => [r.row, r.phone, r.role, r.error])).toEqual([
      [2, '919123456789', 'employee', undefined],
      [4, '919000000001', 'hr', undefined],
    ]);
    expect(rows[0]?.employment.departmentId).toBe('d1');
  });

  test('flags bad rows instead of dropping them', () => {
    const rows = parseSheet(
      sheetBytes([
        HEADERS,
        ['', 'NoFirst', '91', '12345', 'Boss', 'Ops', '01/04/2026', 'bad'],
        ['Asha', 'Dup', '91', '9876543210', 'Admin', '', '', ''],
        ['Asha', 'Dup', '91', '9876543210', '', '', '', ''],
      ]),
      false,
      lookups,
    );
    expect(rows[0]?.error).toContain('First and last name are required');
    expect(rows[0]?.error).toContain('Phone number must be 10 digits');
    expect(rows[0]?.error).toContain('Role must be Employee, HR or Admin');
    expect(rows[0]?.error).toContain('Unknown department "Ops"');
    expect(rows[0]?.error).toContain('Hire Date must be YYYY-MM-DD');
    expect(rows[0]?.error).toContain('PAN looks like ABCDE1234F');
    expect(rows[1]?.error).toBe('You can only add employees');
    expect(rows[2]?.error).toBe('Duplicate phone number in this file');
  });

  test('rejects a file without the required headers', () => {
    expect(() => parseSheet(sheetBytes([['Name', 'Mobile'], ['A', '1']]), true, lookups)).toThrow('Missing column');
  });
});
