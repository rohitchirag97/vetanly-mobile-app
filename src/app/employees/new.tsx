import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { CountryCodeButton } from '@/components/country-code-button';
import { ROLE_LABELS } from '@/components/organization-switcher';
import { ScreenHeader } from '@/components/screen-header';
import { SelectField } from '@/components/select-field';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, IconChip, type IconName } from '@/components/ui';
import { BrandGradient, Colors, Radius, Spacing } from '@/constants/theme';
import { useEmployeeLookups } from '@/hooks/use-employee-lookups';
import { useTheme } from '@/hooks/use-theme';
import type { EmploymentInput, Role } from '@/lib/employee-sheet';
import { pickOneContact } from '@/lib/contacts';
import { createEmployee, saveEmployment } from '@/lib/employees';
import { errorHaptic, selectHaptic, successHaptic } from '@/lib/haptics';
import { splitPhone } from '@/lib/phone';
import { canManage, isPeopleManager, useSession } from '@/lib/session';

const ROLES: { value: Role; icon: IconName; detail: string }[] = [
  { value: 'employee', icon: 'person', detail: 'Their own attendance, leave and pay' },
  { value: 'hr', icon: 'people', detail: 'Manages people, attendance and leave' },
  { value: 'admin', icon: 'shield-checkmark', detail: 'Everything, including payroll and settings' },
];

const EMPTY = { fname: '', lname: '', phone: '', role: 'employee' as Role, branchId: '', jobTitle: '', employeeCode: '', departmentId: '', shiftId: '', hireDate: '' };

export default function AddEmployeeScreen() {
  const theme = useTheme();
  const { activeOrganization } = useSession();
  const { lookups } = useEmployeeLookups(activeOrganization?.id);
  const [form, setForm] = useState(EMPTY);
  const [countryCode, setCountryCode] = useState('91');
  const [showJob, setShowJob] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; note: string | null } | null>(null);

  if (!activeOrganization || !isPeopleManager(activeOrganization)) {
    return <NotAllowed />;
  }
  const organizationId = activeOrganization.id;
  // Same rule as the web form: HR and branch-limited admins add employees only.
  const canElevate = canManage(activeOrganization);
  const roles = canElevate ? ROLES : ROLES.filter((role) => role.value === 'employee');
  const limitedTo = lookups?.limitedTo ?? null;
  const branchRequired = !!limitedTo && limitedTo.length > 1;
  const set = (patch: Partial<typeof EMPTY>) => setForm((current) => ({ ...current, ...patch }));
  const fullName = `${form.fname} ${form.lname}`.trim();

  const fillFromContact = async () => {
    setError(null);
    try {
      const person = await pickOneContact();
      if (!person) return;
      const split = person.phone ? splitPhone(person.phone) : null;
      if (!split) {
        setError(`${person.name} has no mobile number Vetanly can use. Type it in instead.`);
        set({ fname: person.fname, lname: person.lname });
        return;
      }
      selectHaptic();
      setCountryCode(split.countryCode);
      set({ fname: person.fname, lname: person.lname, phone: split.national });
      if (!person.lname) setError('This contact has no last name. Add one before saving.');
    } catch (err) {
      setError((err as Error).message || 'Could not open your contacts.');
    }
  };

  const submit = async () => {
    setError(null);
    const digits = form.phone.replace(/\D/g, '');
    const problem =
      !form.fname.trim() || !form.lname.trim()
        ? 'First and last name are required.'
        : digits.length !== 10
          ? 'Enter a valid 10-digit phone number.'
          : branchRequired && !form.branchId
            ? 'Choose which of your branches they join.'
            : form.hireDate && !/^\d{4}-\d{2}-\d{2}$/.test(form.hireDate)
              ? 'Hire date must look like 2026-04-01.'
              : null;
    if (problem) {
      setError(problem);
      errorHaptic();
      return;
    }

    setBusy(true);
    try {
      const { employeeId, message } = await createEmployee(organizationId, {
        fname: form.fname.trim(),
        lname: form.lname.trim(),
        phone: `${countryCode}${digits}`,
        role: form.role,
        ...(form.branchId ? { branchId: form.branchId } : {}),
      });

      const employment: Partial<EmploymentInput> = {};
      if (form.jobTitle.trim()) employment.jobTitle = form.jobTitle.trim().slice(0, 100);
      if (form.employeeCode.trim()) employment.employeeCode = form.employeeCode.trim();
      if (form.departmentId) employment.departmentId = form.departmentId;
      if (form.shiftId) employment.shiftId = form.shiftId;
      if (form.hireDate) employment.hireDate = form.hireDate;
      let note: string | null = message.includes('already') || message.includes('Existing') ? message : null;
      if (employeeId && Object.keys(employment).length > 0) {
        try {
          await saveEmployment(organizationId, employeeId, employment);
        } catch (err) {
          note = `They were added, but the job details weren't saved: ${(err as Error).message}. Add them from the web app.`;
        }
      }
      successHaptic();
      setDone({ name: fullName, note });
    } catch (err) {
      setError((err as Error).message);
      errorHaptic();
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <ThemedView style={styles.flex}>
        <SafeAreaView style={[styles.flex, styles.doneWrap]}>
          <Animated.View entering={ZoomIn.springify().damping(14)} style={[styles.doneBadge, { backgroundColor: theme.successSoft }]}>
            <Ionicons name="checkmark" size={52} color={theme.success} />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(150)} style={styles.doneText}>
            <ThemedText type="display" style={styles.center}>
              {done.name} is in!
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.center}>
              They can now sign in to Vetanly with their phone number.
            </ThemedText>
            {done.note && (
              <Card style={[styles.note, { backgroundColor: theme.warningSoft }]}>
                <Ionicons name="information-circle" size={18} color={theme.warning} />
                <ThemedText type="small" style={[styles.flex, { color: theme.warning }]}>
                  {done.note}
                </ThemedText>
              </Card>
            )}
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(250)} style={styles.doneActions}>
            <Button
              title="Add another"
              icon="person-add"
              onPress={() => {
                setForm({ ...EMPTY, branchId: form.branchId });
                setShowJob(false);
                setDone(null);
              }}
            />
            <Button title="Done" variant="secondary" onPress={() => router.back()} />
          </Animated.View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        <ScreenHeader title="Add employee" subtitle={activeOrganization.name} />
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <IdCardPreview
              name={fullName}
              phone={form.phone ? `+${countryCode} ${form.phone}` : ''}
              role={ROLE_LABELS[form.role]}
              organization={activeOrganization.name}
              jobTitle={form.jobTitle}
            />

            <Animated.View entering={FadeInDown.delay(60)}>
              <Card style={styles.card}>
                <View style={styles.titleRow}>
                  <CardTitle icon="person-circle" title="Basic details" />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Fill from a contact"
                    onPress={fillFromContact}
                    disabled={busy}
                    hitSlop={6}
                    style={({ pressed }) => [styles.contactChip, { backgroundColor: theme.infoSoft }, pressed && { opacity: 0.7 }]}>
                    <Ionicons name="people-circle" size={18} color={theme.info} />
                    <ThemedText type="smallBold" style={{ color: theme.info }}>
                      From contacts
                    </ThemedText>
                  </Pressable>
                </View>
                <View style={styles.nameRow}>
                  <View style={styles.flex}>
                    <TextField label="First name" value={form.fname} onChangeText={(fname) => set({ fname })} placeholder="Asha" maxLength={52} editable={!busy} autoCapitalize="words" />
                  </View>
                  <View style={styles.flex}>
                    <TextField label="Last name" value={form.lname} onChangeText={(lname) => set({ lname })} placeholder="Sharma" maxLength={52} editable={!busy} autoCapitalize="words" />
                  </View>
                </View>
                <TextField
                  label="Phone number"
                  hint="They sign in with this number."
                  value={form.phone}
                  onChangeText={(text) => set({ phone: text.replace(/[^\d\s]/g, '') })}
                  placeholder="98765 43210"
                  keyboardType="phone-pad"
                  maxLength={12}
                  editable={!busy}
                  leading={<CountryCodeButton value={countryCode} onChange={setCountryCode} disabled={busy} />}
                />
                <View style={styles.roleBlock}>
                  <ThemedText type="smallBold">Role</ThemedText>
                  {roles.map((role) => {
                    const selected = form.role === role.value;
                    return (
                      <Pressable
                        key={role.value}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected }}
                        disabled={busy}
                        onPress={() => {
                          selectHaptic();
                          set({ role: role.value });
                        }}
                        style={[
                          styles.roleOption,
                          { backgroundColor: selected ? theme.primarySoft : theme.backgroundSelected, borderColor: selected ? theme.primary : 'transparent' },
                        ]}>
                        <Ionicons name={role.icon} size={20} color={selected ? theme.primary : theme.textSecondary} />
                        <View style={styles.flex}>
                          <ThemedText style={[styles.roleTitle, selected && { color: theme.primary }]}>{ROLE_LABELS[role.value]}</ThemedText>
                          <ThemedText type="caption" themeColor="textSecondary">
                            {role.detail}
                          </ThemedText>
                        </View>
                        <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? theme.primary : theme.border} />
                      </Pressable>
                    );
                  })}
                </View>
                {!!lookups?.branches.length && (
                  <SelectField
                    label={branchRequired ? 'Branch' : 'Branch (optional)'}
                    value={form.branchId}
                    onChange={(branchId) => set({ branchId })}
                    options={lookups.branches.map((branch) => ({ value: branch.id, label: branch.name }))}
                    optional={!branchRequired}
                    disabled={busy}
                  />
                )}
              </Card>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(120)}>
              <Card style={styles.card}>
                <Pressable accessibilityRole="button" accessibilityState={{ expanded: showJob }} onPress={() => setShowJob(!showJob)} style={styles.toggle}>
                  <CardTitle icon="briefcase" title="Job details" />
                  <View style={styles.toggleRight}>
                    <ThemedText type="caption" themeColor="textSecondary">
                      Optional
                    </ThemedText>
                    <Ionicons name={showJob ? 'chevron-up' : 'chevron-down'} size={20} color={theme.textSecondary} />
                  </View>
                </Pressable>
                {showJob && (
                  <>
                    <TextField label="Job title" value={form.jobTitle} onChangeText={(jobTitle) => set({ jobTitle })} placeholder="Sales Executive" maxLength={100} editable={!busy} />
                    <View style={styles.nameRow}>
                      <View style={styles.flex}>
                        <TextField label="Employee code" value={form.employeeCode} onChangeText={(employeeCode) => set({ employeeCode })} placeholder="EMP001" maxLength={32} autoCapitalize="characters" editable={!busy} />
                      </View>
                      <View style={styles.flex}>
                        <TextField
                          label="Hire date"
                          value={form.hireDate}
                          onChangeText={(hireDate) => set({ hireDate: hireDate.replace(/[^\d-]/g, '') })}
                          placeholder="YYYY-MM-DD"
                          keyboardType="numbers-and-punctuation"
                          maxLength={10}
                          editable={!busy}
                        />
                      </View>
                    </View>
                    {!!lookups?.departments.length && (
                      <SelectField
                        label="Department"
                        value={form.departmentId}
                        onChange={(departmentId) => set({ departmentId })}
                        options={lookups.departments.map((item) => ({ value: item.id, label: item.name }))}
                        optional
                        disabled={busy}
                      />
                    )}
                    {!!lookups?.shifts.length && (
                      <SelectField
                        label="Shift"
                        value={form.shiftId}
                        onChange={(shiftId) => set({ shiftId })}
                        options={lookups.shifts.map((item) => ({ value: item.id, label: item.name }))}
                        optional
                        disabled={busy}
                      />
                    )}
                    <ThemedText type="caption" themeColor="textSecondary">
                      Pay, salary and statutory details are added from the web app for now.
                    </ThemedText>
                  </>
                )}
              </Card>
            </Animated.View>

            {error && (
              <View style={[styles.error, { backgroundColor: theme.dangerSoft }]}>
                <Ionicons name="alert-circle" size={18} color={theme.danger} />
                <ThemedText type="small" style={[styles.flex, { color: theme.danger }]} accessibilityRole="alert">
                  {error}
                </ThemedText>
              </View>
            )}

            <Button title="Add employee" icon="person-add" onPress={submit} loading={busy} disabled={busy} />
            <Pressable accessibilityRole="button" onPress={() => router.replace('/employees/bulk')} style={styles.bulkLink}>
              <Ionicons name="cloud-upload-outline" size={18} color={theme.primary} />
              <ThemedText type="smallBold" style={{ color: theme.primary }}>
                Adding many people? Upload a spreadsheet
              </ThemedText>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

/** A live preview of the person as an ID badge, filling in as the form is typed. */
function IdCardPreview({ name, phone, role, organization, jobTitle }: { name: string; phone: string; role: string; organization: string; jobTitle: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  return (
    <Animated.View entering={FadeInDown} style={[styles.idCard, { backgroundColor: Colors.light.primary, experimental_backgroundImage: BrandGradient }]}>
      <View pointerEvents="none" style={styles.idOrb} />
      <View style={styles.idTop}>
        <Text style={styles.idOrg} numberOfLines={1}>
          {organization.toUpperCase()}
        </Text>
        <View style={styles.idChip}>
          <Ionicons name="finger-print" size={14} color="#fff" />
          <Text style={styles.idChipText}>Vetanly ID</Text>
        </View>
      </View>
      <View style={styles.idBody}>
        <View style={styles.idPhoto}>
          {initials ? <Text style={styles.idInitials}>{initials}</Text> : <Ionicons name="person" size={30} color="rgba(255,255,255,0.7)" />}
        </View>
        <View style={styles.flex}>
          <Text style={styles.idName} numberOfLines={1}>
            {name || 'New teammate'}
          </Text>
          <Text style={styles.idMeta} numberOfLines={1}>
            {jobTitle || role}
          </Text>
          <Text style={styles.idPhone} numberOfLines={1}>
            {phone || '+91 ••••• •••••'}
          </Text>
        </View>
      </View>
      <View style={styles.idStripe} />
    </Animated.View>
  );
}

function CardTitle({ icon, title }: { icon: IconName; title: string }) {
  const theme = useTheme();
  return (
    <View style={styles.cardTitle}>
      <Ionicons name={icon} size={18} color={theme.primary} />
      <ThemedText type="heading">{title}</ThemedText>
    </View>
  );
}

function NotAllowed() {
  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <ScreenHeader title="Add employee" />
        <View style={styles.doneWrap}>
          <IconChip name="lock-closed" tone="warning" size={60} />
          <ThemedText type="title" style={styles.center}>
            Only owners, admins and HR can add employees
          </ThemedText>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.five, maxWidth: 560, width: '100%', alignSelf: 'center' },
  card: { gap: Spacing.three },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  contactChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  nameRow: { flexDirection: 'row', gap: 12 },
  roleBlock: { gap: Spacing.two },
  roleOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: Radius.md, borderWidth: 1.5 },
  roleTitle: { fontWeight: 600 },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: Radius.sm },
  bulkLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: Spacing.two },
  idCard: { borderRadius: Radius.lg, padding: Spacing.three + 2, overflow: 'hidden', gap: Spacing.three, boxShadow: '0px 12px 30px rgba(59, 31, 184, 0.35)' },
  idOrb: { position: 'absolute', width: 200, height: 200, borderRadius: 100, right: -60, top: -80, backgroundColor: 'rgba(255,255,255,0.1)' },
  idTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  idOrg: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 800, letterSpacing: 1.4, flexShrink: 1 },
  idChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)' },
  idChipText: { color: '#fff', fontSize: 11, fontWeight: 700 },
  idBody: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  idPhoto: {
    width: 64,
    height: 72,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  idInitials: { color: '#fff', fontSize: 24, fontWeight: 800 },
  idName: { color: '#fff', fontSize: 20, lineHeight: 26, fontWeight: 800, letterSpacing: -0.3 },
  idMeta: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 600, marginTop: 2 },
  idPhone: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 6, letterSpacing: 0.5 },
  idStripe: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', width: '40%' },
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
  doneBadge: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center' },
  doneText: { gap: Spacing.two, alignItems: 'center', alignSelf: 'stretch' },
  note: { flexDirection: 'row', gap: 8, marginTop: Spacing.two, alignSelf: 'stretch' },
  doneActions: { alignSelf: 'stretch', gap: Spacing.two, marginTop: Spacing.three, maxWidth: 420, width: '100%' },
});
