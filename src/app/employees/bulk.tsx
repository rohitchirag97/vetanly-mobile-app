import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ContactPicker } from '@/components/contact-picker';
import { ScreenHeader } from '@/components/screen-header';
import { SelectField } from '@/components/select-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Avatar, Card, IconChip, ListRow, Pill } from '@/components/ui';
import { Radius, Spacing, type Tone } from '@/constants/theme';
import { useEmployeeLookups } from '@/hooks/use-employee-lookups';
import { useTheme } from '@/hooks/use-theme';
import type { ContactPerson } from '@/lib/contacts';
import { buildTemplate, MAX_ROWS, parseSheet, type SheetRow } from '@/lib/employee-sheet';
import { bulkCreate, checkBulk, saveEmployment, saveStatutory, type BulkCheck } from '@/lib/employees';
import { errorHaptic, selectHaptic, successHaptic } from '@/lib/haptics';
import { loadNative } from '@/lib/native';
import { formatPhone } from '@/lib/phone';
import { canManage, isPeopleManager, useSession } from '@/lib/session';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** What the import will do with a row, decided by the server check before anything is written. Mirrors the web page. */
type Plan = { action: 'import' | 'skip' | 'blocked'; note: string; kind?: 'new' | 'existing' | 'reactivated' };

const planRows = (rows: SheetRow[], check: BulkCheck): Record<number, Plan> => {
  const plans: Record<number, Plan> = {};
  for (const row of rows) {
    if (row.error) continue;
    const found = check.phones[row.phone];
    const status = found?.status ?? 'new';
    const code = row.employment.employeeCode;
    const codeHolder = code ? check.takenCodes[code] : undefined;
    const who = found?.name ? ` (${found.name})` : '';
    if (status === 'member') plans[row.row] = { action: 'skip', note: `Already in this organization${who}` };
    else if (status === 'not-allowed') plans[row.row] = { action: 'blocked', note: `You can't add or change this person${who}` };
    else if (codeHolder && codeHolder !== row.phone) plans[row.row] = { action: 'blocked', note: `Code "${code}" is used by +${codeHolder}` };
    else if (status === 'existing-user') plans[row.row] = { action: 'import', kind: 'existing', note: `Has a Vetanly account${who}` };
    else if (status === 'inactive-member') plans[row.row] = { action: 'import', kind: 'reactivated', note: `Former employee${who}, will be reactivated` };
    else plans[row.row] = { action: 'import', kind: 'new', note: 'New employee' };
  }
  return plans;
};

const RESULT_TEXT: Record<string, string> = {
  created: 'Created',
  added: 'Added to organization',
  'already-member': 'Already a member',
  forbidden: 'Not allowed',
  'duplicate-in-file': 'Duplicate in file',
  failed: 'Failed',
  'details-failed': 'Added, but job/pay details not saved',
};
const FAILED = ['forbidden', 'failed', 'duplicate-in-file', 'details-failed'];

type Filter = 'all' | 'ready' | 'problems';

export default function BulkUploadScreen() {
  const theme = useTheme();
  const { activeOrganization } = useSession();
  const { lookups, error: lookupError, loading: lookupsLoading } = useEmployeeLookups(activeOrganization?.id);
  const [fileName, setFileName] = useState<string | null>(null);
  const [source, setSource] = useState<'file' | 'contacts'>('file');
  const [pickingContacts, setPickingContacts] = useState(false);
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [plans, setPlans] = useState<Record<number, Plan>>({});
  const [results, setResults] = useState<Record<number, string>>({});
  const [branchId, setBranchId] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState<'template' | 'reading' | 'importing' | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!activeOrganization || !isPeopleManager(activeOrganization)) {
    return (
      <ThemedView style={styles.flex}>
        <SafeAreaView style={styles.flex}>
          <ScreenHeader title="Bulk upload" />
          <View style={styles.centered}>
            <IconChip name="lock-closed" tone="warning" size={60} />
            <ThemedText type="title" style={styles.center}>
              Only owners, admins and HR can add employees
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }
  const organizationId = activeOrganization.id;
  const canElevate = canManage(activeOrganization);
  const limitedTo = lookups?.limitedTo ?? null;
  const branchRequired = !!limitedTo && limitedTo.length > 1;

  const importRows = rows.filter((row) => !row.error && plans[row.row]?.action === 'import');
  const problems = rows.filter((row) => row.error || plans[row.row]?.action === 'blocked');
  const skipped = rows.filter((row) => plans[row.row]?.action === 'skip');
  const ofKind = (kind: Plan['kind']) => importRows.filter((row) => plans[row.row]?.kind === kind).length;
  const checked = Object.keys(plans).length > 0;
  const done = Object.keys(results).length > 0;
  const imported = Object.values(results).filter((s) => ['created', 'added', 'details-failed'].includes(s)).length;
  const step = done ? 4 : checked ? 3 : rows.length ? 2 : 1;

  const shareTemplate = async () => {
    setError(null);
    setBusy('template');
    try {
      const [{ File, Paths }, Sharing] = await Promise.all([
        loadNative(() => import('expo-file-system'), 'Sharing the template'),
        loadNative(() => import('expo-sharing'), 'Sharing the template'),
      ]);
      const file = new File(Paths.cache, 'vetanly-employee-template.xlsx');
      if (file.exists) file.delete();
      file.create();
      file.write(buildTemplate(lookups ?? { departments: [], shifts: [] }));
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
      await Sharing.shareAsync(file.uri, { mimeType: XLSX_MIME, dialogTitle: 'Employee template', UTI: 'org.openxmlformats.spreadsheetml.sheet' });
    } catch (err) {
      setError((err as Error).message || 'Could not create the template.');
    } finally {
      setBusy(null);
    }
  };

  const reset = (label: string, from: 'file' | 'contacts') => {
    setError(null);
    setFileName(label);
    setSource(from);
    setRows([]);
    setPlans({});
    setResults({});
    setFilter('all');
  };

  /** Shows the rows, then asks the server how each compares with people already in the organization. */
  const review = async (parsed: SheetRow[]) => {
    setRows(parsed);
    const valid = parsed.filter((row) => !row.error);
    if (valid.length === 0) return;
    const codes = valid.flatMap((row) => (row.employment.employeeCode ? [row.employment.employeeCode] : []));
    try {
      setPlans(planRows(parsed, await checkBulk(organizationId, valid.map((row) => row.phone), codes)));
    } catch (err) {
      setError(`Couldn't compare these people with your existing employees, so nothing can be imported yet. ${(err as Error).message} Try again.`);
    }
  };

  const chooseFile = async () => {
    setError(null);
    let modules;
    try {
      modules = await Promise.all([
        loadNative(() => import('expo-document-picker'), 'Uploading a spreadsheet'),
        loadNative(() => import('expo-file-system'), 'Uploading a spreadsheet'),
      ]);
    } catch (err) {
      setError((err as Error).message);
      return;
    }
    const [DocumentPicker, { File }] = modules;
    const picked = await DocumentPicker.getDocumentAsync({
      type: [XLSX_MIME, 'application/vnd.ms-excel', 'text/csv', 'text/comma-separated-values'],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    reset(asset.name, 'file');
    setBusy('reading');
    try {
      const bytes = await new File(asset.uri).bytes();
      await review(parseSheet(bytes, canElevate, lookups ?? { departments: [], shifts: [] }));
      selectHaptic();
    } catch (err) {
      setError((err as Error).message || 'Could not read the file.');
      errorHaptic();
    } finally {
      setBusy(null);
    }
  };

  // Contacts become rows like a sheet's: everyone joins as an employee, and the same checks apply.
  const addFromContacts = async (people: ContactPerson[]) => {
    setPickingContacts(false);
    reset(`${people.length} ${people.length === 1 ? 'contact' : 'contacts'}`, 'contacts');
    setBusy('reading');
    const seen = new Set<string>();
    const parsed: SheetRow[] = people.map((person, index) => {
      const phone = person.phone ?? '';
      const errors: string[] = [];
      if (!person.fname || !person.lname) errors.push('Needs a first and last name. Edit the contact, or add them one by one');
      if (seen.has(phone)) errors.push('Same number as another selected contact');
      seen.add(phone);
      return { row: index + 1, fname: person.fname, lname: person.lname, phone, role: 'employee', employment: {}, statutory: null, error: errors.join('; ') || undefined };
    });
    try {
      await review(parsed);
      selectHaptic();
    } finally {
      setBusy(null);
    }
  };

  const runImport = async () => {
    setError(null);
    if (branchRequired && !branchId) {
      setError('Choose which of your branches these people join.');
      return;
    }
    setBusy('importing');
    setProgress('Adding people…');
    try {
      const created = await bulkCreate(
        organizationId,
        importRows.map(({ fname, lname, phone, role }) => ({ fname, lname, phone, role })),
        branchId || undefined,
      );
      const byRow: Record<number, string> = {};
      let index = 0;
      for (const result of created) {
        index += 1;
        // The server numbers results by position in the list sent, starting at 1.
        const sourceRow = importRows[result.row - 1];
        if (!sourceRow) continue;
        let status = result.status;
        if (result.employeeId && (status === 'created' || status === 'added')) {
          setProgress(`Saving details ${index} of ${created.length}…`);
          try {
            if (Object.keys(sourceRow.employment).length > 0) await saveEmployment(organizationId, result.employeeId, sourceRow.employment);
            if (sourceRow.statutory) await saveStatutory(organizationId, result.employeeId, sourceRow.statutory);
          } catch {
            status = 'details-failed';
          }
        }
        byRow[sourceRow.row] = status;
      }
      setResults(byRow);
      successHaptic();
    } catch (err) {
      setError((err as Error).message || 'Import failed.');
      errorHaptic();
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const rowStatus = (row: SheetRow): { text: string; tone: Tone | 'neutral' } => {
    const result = results[row.row];
    if (result) return { text: RESULT_TEXT[result] ?? result, tone: FAILED.includes(result) ? 'danger' : 'success' };
    if (row.error) return { text: row.error, tone: 'danger' };
    const plan = plans[row.row];
    if (!plan) return { text: 'Not checked', tone: 'neutral' };
    return { text: plan.note, tone: plan.action === 'blocked' ? 'danger' : plan.action === 'skip' ? 'neutral' : plan.kind === 'new' ? 'success' : 'info' };
  };

  const visible = rows.filter((row) =>
    filter === 'all' ? true : filter === 'ready' ? !row.error && plans[row.row]?.action === 'import' : row.error || plans[row.row]?.action === 'blocked',
  );

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        <ScreenHeader title="Bulk upload" subtitle={activeOrganization.name} />
        <ScrollView contentContainerStyle={styles.content}>
          <Stepper step={step} />

          {lookupError && (
            <Card style={[styles.inline, { backgroundColor: theme.warningSoft }]}>
              <Ionicons name="warning" size={18} color={theme.warning} />
              <ThemedText type="small" style={[styles.flex, { color: theme.warning }]}>
                Couldn&apos;t load departments and shifts ({lookupError}). Rows that name one will be flagged.
              </ThemedText>
            </Card>
          )}

          {!done && (
            <Animated.View entering={FadeInDown}>
              <Card style={styles.stepCard}>
                <View style={styles.stepHead}>
                  <IconChip name="document-text" tone="success" size={44} />
                  <View style={styles.flex}>
                    <ThemedText type="heading">1. Get the template</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      One person per row, up to 500. Fill it in Excel or Google Sheets, then come back.
                    </ThemedText>
                  </View>
                </View>
                <Button title="Share template" variant="secondary" icon="share-outline" onPress={shareTemplate} loading={busy === 'template'} disabled={!!busy || lookupsLoading} />
              </Card>
            </Animated.View>
          )}

          {!done && (
            <Animated.View entering={FadeInDown.delay(80)}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={fileName ? `Selected file ${fileName}. Choose another` : 'Choose a filled spreadsheet'}
                disabled={!!busy || lookupsLoading}
                onPress={chooseFile}
                style={({ pressed }) => [
                  styles.dropZone,
                  { borderColor: theme.primary, backgroundColor: theme.primarySoft },
                  (pressed || lookupsLoading) && { opacity: 0.7 },
                ]}>
                {busy === 'reading' || lookupsLoading ? (
                  <ActivityIndicator color={theme.primary} />
                ) : (
                  <View style={[styles.dropIcon, { backgroundColor: theme.primary }]}>
                    <Ionicons name={fileName ? 'document-attach' : 'cloud-upload'} size={28} color={theme.onPrimary} />
                  </View>
                )}
                <ThemedText type="heading" style={{ color: theme.primary }}>
                  {busy === 'reading' ? 'Reading and checking…' : fileName ?? '2. Choose the filled sheet'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                  {fileName ? (source === 'contacts' ? 'Tap to upload a spreadsheet instead' : 'Tap to choose a different file') : '.xlsx or .csv with the template headers'}
                </ThemedText>
              </Pressable>

              <View style={styles.orRow}>
                <View style={[styles.orLine, { backgroundColor: theme.border }]} />
                <ThemedText type="caption" themeColor="textSecondary">
                  OR
                </ThemedText>
                <View style={[styles.orLine, { backgroundColor: theme.border }]} />
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={!!busy}
                onPress={() => setPickingContacts(true)}
                style={({ pressed }) => [pressed && { opacity: 0.7, transform: [{ scale: 0.99 }] }]}>
                <Card style={styles.contactsCard}>
                  <IconChip name="people-circle" tone="info" size={48} />
                  <View style={styles.flex}>
                    <ThemedText type="heading">Pick from contacts</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Choose people straight from your phone. They join as employees.
                    </ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                </Card>
              </Pressable>
            </Animated.View>
          )}

          {error && (
            <View style={[styles.inline, styles.errorBox, { backgroundColor: theme.dangerSoft }]}>
              <Ionicons name="alert-circle" size={18} color={theme.danger} />
              <ThemedText type="small" style={[styles.flex, { color: theme.danger }]} accessibilityRole="alert">
                {error}
              </ThemedText>
            </View>
          )}

          {done && (
            <Animated.View entering={FadeInDown}>
              <Card style={[styles.stepCard, styles.doneCard]}>
                <View style={[styles.doneBadge, { backgroundColor: theme.successSoft }]}>
                  <Ionicons name="checkmark" size={40} color={theme.success} />
                </View>
                <ThemedText type="title" style={styles.center}>
                  {imported} {imported === 1 ? 'person' : 'people'} added
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                  They can sign in to Vetanly with their phone numbers. Check any rows marked below.
                </ThemedText>
                <View style={styles.doneActions}>
                  <Button title="Done" onPress={() => router.back()} />
                  <Button
                    title="Upload another file"
                    variant="secondary"
                    onPress={() => {
                      setRows([]);
                      setPlans({});
                      setResults({});
                      setFileName(null);
                    }}
                  />
                </View>
              </Card>
            </Animated.View>
          )}

          {rows.length > 0 && (
            <Animated.View entering={FadeInDown.delay(60)} style={styles.review}>
              <ThemedText type="heading">{done ? 'Results' : '3. Review'}</ThemedText>
              {!done && (
                <View style={styles.summary}>
                  <Summary value={ofKind('new')} label="New" tone="success" />
                  <Summary value={ofKind('existing') + ofKind('reactivated')} label="Existing" tone="info" />
                  <Summary value={skipped.length} label="Skipped" tone="primary" />
                  <Summary value={problems.length} label="Problems" tone="danger" />
                </View>
              )}

              <View style={[styles.filters, { backgroundColor: theme.backgroundSelected }]}>
                {(
                  [
                    ['all', `All ${rows.length}`],
                    ['ready', `Ready ${importRows.length}`],
                    ['problems', `Problems ${problems.length}`],
                  ] as const
                ).map(([value, label]) => (
                  <Pressable
                    key={value}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: filter === value }}
                    onPress={() => setFilter(value)}
                    style={[styles.filter, filter === value && { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText type="smallBold" themeColor={filter === value ? 'text' : 'textSecondary'}>
                      {label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              <Card padded={false} style={styles.list}>
                {visible.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.emptyList}>
                    Nothing here.
                  </ThemedText>
                ) : (
                  visible.map((row, index) => {
                    const status = rowStatus(row);
                    return (
                      <View key={row.row}>
                        <ListRow
                          first={index === 0}
                          leading={<Avatar name={`${row.fname} ${row.lname}`.trim() || '?'} size={38} />}
                          title={`${row.fname} ${row.lname}`.trim() || `Row ${row.row}`}
                          subtitle={source === 'contacts' ? (row.phone ? formatPhone(row.phone) : 'No number') : `Row ${row.row} · +${row.phone}`}
                          trailing={status.tone === 'danger' ? <Ionicons name="alert-circle" size={20} color={theme.danger} /> : <Pill label={status.tone === 'neutral' ? 'Skip' : status.tone === 'success' ? (done ? 'Done' : 'New') : 'Update'} tone={status.tone} />}
                        />
                        <ThemedText type="caption" style={[styles.rowNote, { color: status.tone === 'danger' ? theme.danger : theme.textSecondary }]}>
                          {status.text}
                        </ThemedText>
                      </View>
                    );
                  })
                )}
              </Card>
            </Animated.View>
          )}

          {checked && !done && importRows.length > 0 && (
            <Animated.View entering={FadeInDown.delay(120)} style={styles.importBlock}>
              {!!lookups?.branches.length && (
                <SelectField
                  label={branchRequired ? 'Branch for everyone' : 'Branch for everyone (optional)'}
                  value={branchId}
                  onChange={setBranchId}
                  options={lookups.branches.map((branch) => ({ value: branch.id, label: branch.name }))}
                  optional={!branchRequired}
                  disabled={!!busy}
                />
              )}
              <Button
                title={progress ?? `4. Import ${importRows.length} ${importRows.length === 1 ? 'person' : 'people'}`}
                icon="people"
                onPress={runImport}
                loading={busy === 'importing'}
                disabled={!!busy}
              />
              {problems.length > 0 && (
                <ThemedText type="caption" themeColor="textSecondary" style={styles.center}>
                  Rows with problems are left out. Fix them in the sheet and upload it again later.
                </ThemedText>
              )}
            </Animated.View>
          )}
        </ScrollView>
      </SafeAreaView>
      {pickingContacts && <ContactPicker max={MAX_ROWS} onClose={() => setPickingContacts(false)} onConfirm={addFromContacts} />}
    </ThemedView>
  );
}

const STEPS = ['Template', 'Upload', 'Review', 'Import'];

/** Where the user is in the four steps, as a progress rail. */
function Stepper({ step }: { step: number }) {
  const theme = useTheme();
  return (
    <View style={styles.stepper} accessibilityLabel={`Step ${step} of 4: ${STEPS[step - 1]}`}>
      {STEPS.map((label, i) => {
        const n = i + 1;
        const complete = n < step;
        const current = n === step;
        return (
          <View key={label} style={styles.stepItem}>
            <View style={styles.stepTrackRow}>
              <View style={[styles.stepLine, { backgroundColor: i === 0 ? 'transparent' : n <= step ? theme.primary : theme.border }]} />
              <View
                style={[
                  styles.stepDot,
                  { backgroundColor: complete || current ? theme.primary : theme.backgroundElement, borderColor: complete || current ? theme.primary : theme.border },
                ]}>
                {complete ? (
                  <Ionicons name="checkmark" size={14} color={theme.onPrimary} />
                ) : (
                  <ThemedText type="caption" style={{ color: current ? theme.onPrimary : theme.textSecondary, fontWeight: 700 }}>
                    {n}
                  </ThemedText>
                )}
              </View>
              <View style={[styles.stepLine, { backgroundColor: i === STEPS.length - 1 ? 'transparent' : n < step ? theme.primary : theme.border }]} />
            </View>
            <ThemedText type="caption" themeColor={current ? 'text' : 'textSecondary'}>
              {label}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

function Summary({ value, label, tone }: { value: number; label: string; tone: Tone }) {
  const theme = useTheme();
  const soft = { primary: theme.primarySoft, success: theme.successSoft, warning: theme.warningSoft, danger: theme.dangerSoft, info: theme.infoSoft }[tone];
  return (
    <View style={[styles.summaryItem, { backgroundColor: soft }]}>
      <ThemedText type="title" style={{ color: theme[tone] }}>
        {value}
      </ThemedText>
      <ThemedText type="caption" style={{ color: theme[tone] }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six, maxWidth: 640, width: '100%', alignSelf: 'center' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorBox: { padding: 12, borderRadius: Radius.sm },
  stepCard: { gap: Spacing.three },
  stepHead: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  dropZone: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.five, paddingHorizontal: Spacing.four, borderRadius: Radius.lg, borderWidth: 2, borderStyle: 'dashed' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginVertical: Spacing.three },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth },
  contactsCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  dropIcon: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.one },
  review: { gap: 12 },
  summary: { flexDirection: 'row', gap: Spacing.two },
  summaryItem: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: Radius.md },
  filters: { flexDirection: 'row', borderRadius: Radius.md, padding: 4, gap: 4 },
  filter: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: Radius.sm },
  list: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  rowNote: { marginTop: -6, marginBottom: 10, marginLeft: 50 },
  emptyList: { paddingVertical: Spacing.three, textAlign: 'center' },
  importBlock: { gap: 12 },
  doneCard: { alignItems: 'center' },
  doneBadge: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  doneActions: { alignSelf: 'stretch', gap: Spacing.two },
  stepper: { flexDirection: 'row', paddingVertical: Spacing.two },
  stepItem: { flex: 1, alignItems: 'center', gap: 6 },
  stepTrackRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  stepLine: { flex: 1, height: 2 },
  stepDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
