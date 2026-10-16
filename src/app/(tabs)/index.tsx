import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { BrandHeader } from '@/components/brand-header';
import { OrganizationSwitcher } from '@/components/organization-switcher';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Avatar, Card, IconChip, ListRow, Pill, SectionHeader, type IconName } from '@/components/ui';
import { BrandGradient, Radius, Spacing, type Tone } from '@/constants/theme';
import { useDashboard } from '@/hooks/use-dashboard';
import { useTheme } from '@/hooks/use-theme';
import { useBilling } from '@/lib/billing';
import { canManage, isPeopleManager, useSession } from '@/lib/session';

const pad = (value: number) => String(value).padStart(2, '0');
// A YYYY-MM-DD key in local time, the format the server uses for leave and holiday dates.
const localDateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const toDate = (key: string) => new Date(`${key.slice(0, 10)}T00:00:00`);
const formatDate = (date: string) => toDate(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const formatTime = (date: string) => new Date(date).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const relativeDay = (date: string) => {
  const days = Math.round((toDate(date).getTime() - toDate(localDateKey(new Date())).getTime()) / 86_400_000);
  return days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;
};
const formatMoney = (amount: number, currency = 'INR') =>
  `${currency === 'INR' ? '₹' : `${currency} `}${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
// The header's mood follows the time of day, so opening the app at 8am and at 10pm feel different.
const dayPart = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12)
    return { greeting: 'Good morning', line: "Fresh start. Let's make today count.", icon: 'sunny' as IconName, gradient: 'linear-gradient(150deg, #FF9A76 0%, #EE6A8E 36%, #7B5CFF 100%)', fallback: '#EE6A8E', stars: false };
  if (hour >= 12 && hour < 17)
    return { greeting: 'Good afternoon', line: 'Keep the momentum going.', icon: 'partly-sunny' as IconName, gradient: BrandGradient, fallback: '#5938E8', stars: false };
  if (hour >= 17 && hour < 20)
    return { greeting: 'Good evening', line: 'Wrapping up the day.', icon: 'cloudy-night' as IconName, gradient: 'linear-gradient(150deg, #F7A440 0%, #E0457B 42%, #4B2AAD 100%)', fallback: '#E0457B', stars: false };
  return { greeting: 'Good evening', line: 'Rest well, see you tomorrow.', icon: 'moon' as IconName, gradient: 'linear-gradient(165deg, #2A2670 0%, #231C5E 45%, #0E0B26 100%)', fallback: '#231C5E', stars: true };
};

type Stat = { label: string; value: string | number; icon: IconName; tone: Tone };

const QUICK_ACTIONS: { label: string; icon: IconName; href: Href }[] = [
  { label: 'Add person', icon: 'person-add', href: '/employees/new' },
  { label: 'Bulk upload', icon: 'cloud-upload', href: '/employees/bulk' },
  { label: 'All tools', icon: 'grid', href: '/menu' },
  { label: 'Profile', icon: 'person-circle', href: '/profile' },
];

export default function HomeScreen() {
  const theme = useTheme();
  const { user, activeOrganization, refresh } = useSession();
  const { billing, reload: reloadBilling } = useBilling();
  // Same split as the web dashboard's Manage view; the mobile app has no separate "My view" yet.
  const isManager = isPeopleManager(activeOrganization);
  const isFinanceManager = canManage(activeOrganization);
  const { data, error, reload } = useDashboard(activeOrganization?.id, isManager);
  const [refreshing, setRefreshing] = useState(false);
  if (!user) return null;
  const mood = dayPart();

  const todayKey = localDateKey(new Date());
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + 30);
  const windowEndKey = localDateKey(windowEnd);

  // Managers receive everyone's records; employees should only count their own.
  const ownOnly = <T extends { employeeId: string }>(rows: T[]) => (isManager ? rows : rows.filter((row) => row.employeeId === user.id));
  const leaves = ownOnly(data?.leaves ?? []);
  const loans = ownOnly(data?.loans ?? []);
  const logs = ownOnly(data?.logs ?? []);

  const pendingLeave = leaves.filter((item) => item.status === 'pending').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const approvedAhead = leaves.filter((item) => item.status === 'approved' && item.endDate.slice(0, 10) >= todayKey);
  const onLeaveToday = approvedAhead.filter((item) => item.startDate.slice(0, 10) <= todayKey).length;

  // Logs are newest first, so the first log per employee is their latest event today.
  const seen = new Set<string>();
  const presentNow = new Set<string>();
  for (const log of logs) {
    if (seen.has(log.employeeId)) continue;
    seen.add(log.employeeId);
    if (log.eventType === 'check_in') presentNow.add(log.employeeId);
  }
  const myLatest = logs.find((log) => log.employeeId === user.id);

  const openLoans = loans.filter((item) => ['pending', 'approved', 'disbursed', 'active'].includes(item.status));
  const outstanding = openLoans
    .filter((item) => item.status === 'disbursed' || item.status === 'active')
    .reduce((sum, item) => sum + Number(item.outstanding), 0);
  const activeEmployees = (data?.employees ?? []).filter((employee) => employee.isActive).length;

  const events = [
    ...(data?.holidays ?? [])
      .filter((holiday) => holiday.date >= todayKey && holiday.date <= windowEndKey)
      .map((holiday) => ({ id: `holiday-${holiday.id}`, date: holiday.date, title: holiday.name, detail: 'Holiday', tone: 'warning' as Tone })),
    ...approvedAhead
      .filter((leave) => leave.startDate.slice(0, 10) <= windowEndKey)
      .map((leave) => ({
        id: `leave-${leave.id}`,
        date: leave.startDate.slice(0, 10) < todayKey ? todayKey : leave.startDate.slice(0, 10),
        title: isManager ? leave.employeeName : leave.leaveTypeName,
        detail: isManager ? leave.leaveTypeName : `${formatDate(leave.startDate)} – ${formatDate(leave.endDate)}`,
        tone: 'primary' as Tone,
      })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);

  const show = (value: string | number) => (data ? value : '–');
  const holidayCount = (data?.holidays ?? []).filter((h) => h.date >= todayKey && h.date <= windowEndKey).length;
  const stats: Stat[] = isManager
    ? [
        { label: 'Active employees', value: show(activeEmployees), icon: 'people', tone: 'primary' },
        { label: 'On leave today', value: show(onLeaveToday), icon: 'airplane', tone: 'warning' },
        { label: 'Leave to review', value: show(pendingLeave.length), icon: 'hourglass', tone: 'danger' },
        isFinanceManager
          ? { label: 'Loan requests', value: show(loans.filter((item) => item.status === 'pending').length), icon: 'cash', tone: 'info' }
          : { label: 'Holidays ahead', value: show(holidayCount), icon: 'sunny', tone: 'info' },
      ]
    : [
        { label: 'Pending leave', value: show(pendingLeave.length), icon: 'hourglass', tone: 'warning' },
        { label: 'Upcoming leave', value: show(approvedAhead.length), icon: 'airplane', tone: 'primary' },
        { label: 'Open loans', value: show(openLoans.length), icon: 'cash', tone: 'info' },
        { label: 'Outstanding', value: show(formatMoney(outstanding, openLoans[0]?.currencyCode)), icon: 'wallet', tone: 'success' },
      ];

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refresh().catch(() => {}), reloadBilling(), reload()]);
    setRefreshing(false);
  };

  return (
    <ThemedView style={styles.flex}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}>
        <BrandHeader gradient={mood.gradient} fallbackColor={mood.fallback} stars={mood.stars}>
          <Ionicons name={mood.icon} size={150} color="rgba(255,255,255,0.12)" style={styles.celestial} pointerEvents="none" />
          <View style={styles.topRow}>
            <OrganizationSwitcher onBrand />
            <Pressable accessibilityRole="button" accessibilityLabel="Profile" onPress={() => router.navigate('/profile')} hitSlop={6}>
              <Avatar name={`${user.fname} ${user.lname}`} size={42} onBrand />
            </Pressable>
          </View>

          <View style={styles.greeting}>
            <Text style={styles.date}>
              {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
            <Text style={styles.hello}>
              {mood.greeting}, {user.fname}
            </Text>
            <Text style={styles.moodLine}>{mood.line}</Text>
            {billing?.state === 'trial' && (
              <View style={styles.trialChip}>
                <Ionicons name="sparkles" size={12} color="#fff" />
                <Text style={styles.trialText}>
                  Free trial · {billing.daysLeft} day{billing.daysLeft === 1 ? '' : 's'} left
                </Text>
              </View>
            )}
          </View>

          <View style={styles.todayCard}>
            {isManager ? (
              <>
                <View style={styles.todayRow}>
                  <View>
                    <Text style={styles.todayLabel}>Present right now</Text>
                    <Text style={styles.todayValue}>
                      {data ? presentNow.size : '–'}
                      {data && activeEmployees > 0 && <Text style={styles.todayTotal}> / {activeEmployees}</Text>}
                    </Text>
                  </View>
                  <View style={styles.todayIcon}>
                    <Ionicons name="people" size={22} color="#fff" />
                  </View>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${activeEmployees ? Math.min(100, (presentNow.size / activeEmployees) * 100) : 0}%` },
                    ]}
                  />
                </View>
                <Text style={styles.todayNote}>
                  {seen.size} checked in today · {onLeaveToday} on leave
                </Text>
              </>
            ) : (
              <View style={styles.todayRow}>
                <View style={styles.flex}>
                  <Text style={styles.todayLabel}>Your attendance today</Text>
                  <Text style={styles.todayStatus}>
                    {!data
                      ? '–'
                      : myLatest?.eventType === 'check_in'
                        ? 'Checked in'
                        : myLatest
                          ? 'Checked out'
                          : 'Not checked in yet'}
                  </Text>
                  {myLatest && <Text style={styles.todayNote}>Last update at {formatTime(myLatest.occurredAt)}</Text>}
                </View>
                <View style={styles.todayIcon}>
                  <Ionicons name={myLatest?.eventType === 'check_in' ? 'checkmark-circle' : 'finger-print'} size={24} color="#fff" />
                </View>
              </View>
            )}
          </View>
          {isManager && (
            <View style={styles.dock}>
              {QUICK_ACTIONS.map((action) => (
                <Pressable
                  key={action.label}
                  accessibilityRole="button"
                  onPress={() => router.navigate(action.href)}
                  style={({ pressed }) => [styles.dockItem, pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] }]}>
                  <View style={styles.dockIcon}>
                    <Ionicons name={action.icon} size={22} color="#fff" />
                  </View>
                  <Text style={styles.dockLabel} numberOfLines={1}>
                    {action.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </BrandHeader>

        <View style={styles.body}>
          <View style={styles.grid}>
            {stats.map((stat, i) => (
              <Animated.View key={stat.label} entering={FadeInDown.delay(i * 70).springify().damping(16)} style={styles.stat}>
              <Card style={styles.statCard}>
                <IconChip name={stat.icon} tone={stat.tone} size={38} />
                <ThemedText type="title" numberOfLines={1} adjustsFontSizeToFit style={styles.statValue}>
                  {stat.value}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {stat.label}
                </ThemedText>
              </Card>
              </Animated.View>
            ))}
          </View>

          {(billing?.state === 'grace' || billing?.state === 'read_only') && (
            <Card style={[styles.alert, { backgroundColor: theme.dangerSoft }]}>
              <IconChip name="alert-circle" tone="danger" size={36} />
              <ThemedText type="small" style={[styles.flex, { color: theme.danger }]}>
                {billing.state === 'grace'
                  ? `Payment is overdue. The workspace turns read-only in ${billing.daysLeft} day${billing.daysLeft === 1 ? '' : 's'}.`
                  : 'Your plan has ended, so the workspace is read-only. Choose a plan in Billing on the web.'}
              </ThemedText>
            </Card>
          )}

          {error && (
            <Card style={[styles.alert, { backgroundColor: theme.dangerSoft }]}>
              <IconChip name="cloud-offline" tone="danger" size={36} />
              <ThemedText type="small" style={[styles.flex, { color: theme.danger }]} accessibilityRole="alert">
                {error}
              </ThemedText>
            </Card>
          )}

          {isManager && pendingLeave.length > 0 && (
            <Animated.View entering={FadeInDown.delay(260)}>
              <SectionHeader title="Needs your review" count={pendingLeave.length} />
              <Card padded={false} style={styles.listCard}>
                {pendingLeave.slice(0, 4).map((request, index) => (
                  <ListRow
                    key={request.id}
                    first={index === 0}
                    leading={<Avatar name={request.employeeName} size={40} />}
                    title={request.employeeName}
                    subtitle={`${request.leaveTypeName} · ${formatDate(request.startDate)} – ${formatDate(request.endDate)}`}
                    trailing={<Pill label="Pending" tone="warning" />}
                  />
                ))}
              </Card>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(320)}>
            <SectionHeader title="Coming up" />
            {!data ? (
              <Loading />
            ) : events.length === 0 ? (
              <EmptyCard icon="calendar-clear-outline" text="Nothing planned for the next 30 days." />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.events} style={styles.eventsScroller}>
                {events.map((event) => (
                  <EventCard key={event.id} {...event} />
                ))}
              </ScrollView>
            )}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(400)}>
            <SectionHeader title="Today's activity" />
            {!data ? (
              <Loading />
            ) : logs.length === 0 ? (
              <EmptyCard icon="time-outline" text="No check-ins recorded yet today." />
            ) : (
              <Card padded={false} style={styles.listCard}>
                {logs.slice(0, 6).map((log, index) => {
                  const checkIn = log.eventType === 'check_in';
                  return (
                    <ListRow
                      key={log.id}
                      first={index === 0}
                      leading={<Avatar name={log.employeeName} size={40} />}
                      title={isManager ? log.employeeName : checkIn ? 'Checked in' : 'Checked out'}
                      subtitle={`${isManager ? (checkIn ? 'Checked in' : 'Checked out') + ' · ' : ''}${log.source === 'kiosk' ? 'Kiosk' : 'Manual entry'}`}
                      trailing={
                        <View style={styles.timeCell}>
                          <View style={[styles.dot, { backgroundColor: checkIn ? theme.success : theme.textSecondary }]} />
                          <ThemedText type="smallBold">{formatTime(log.occurredAt)}</ThemedText>
                        </View>
                      }
                    />
                  );
                })}
              </Card>
            )}
          </Animated.View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function EventCard({ date, title, detail, tone }: { date: string; title: string; detail: string; tone: Tone }) {
  const theme = useTheme();
  const soft = tone === 'warning' ? theme.warningSoft : theme.primarySoft;
  const day = toDate(date);
  return (
    <Card style={styles.event}>
      <View style={[styles.dateBlock, { backgroundColor: soft }]}>
        <Text style={[styles.dateMonth, { color: theme[tone] }]}>{day.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</Text>
        <Text style={[styles.dateDay, { color: theme[tone] }]}>{day.getDate()}</Text>
      </View>
      <View style={styles.eventText}>
        <ThemedText numberOfLines={1} style={styles.eventTitle}>
          {title}
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
          {detail}
        </ThemedText>
      </View>
      <Pill label={relativeDay(date)} tone={tone} />
    </Card>
  );
}

function EmptyCard({ icon, text }: { icon: IconName; text: string }) {
  return (
    <Card style={styles.emptyCard}>
      <IconChip name={icon} tone="primary" size={36} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
        {text}
      </ThemedText>
    </Card>
  );
}

function Loading() {
  return (
    <Card style={styles.loading}>
      <ActivityIndicator />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingBottom: Spacing.five },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  greeting: { marginTop: Spacing.four, gap: 4 },
  date: { color: 'rgba(255,255,255,0.72)', fontSize: 13, fontWeight: 500 },
  hello: { color: '#fff', fontSize: 28, lineHeight: 34, fontWeight: 700, letterSpacing: -0.6 },
  moodLine: { color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 19 },
  // A faint sun or moon behind the greeting.
  celestial: { position: 'absolute', right: -24, top: 40 },
  dock: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.four, gap: Spacing.two },
  dockItem: { flex: 1, alignItems: 'center', gap: 6 },
  dockIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  dockLabel: { color: '#fff', fontSize: 12, fontWeight: 600 },
  trialChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: Spacing.two,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  trialText: { color: '#fff', fontSize: 12, fontWeight: 600 },
  todayCard: {
    marginTop: Spacing.four,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    gap: Spacing.two,
  },
  todayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  todayLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 500 },
  todayValue: { color: '#fff', fontSize: 34, lineHeight: 40, fontWeight: 700, letterSpacing: -0.8 },
  todayTotal: { color: 'rgba(255,255,255,0.6)', fontSize: 20, fontWeight: 600 },
  todayStatus: { color: '#fff', fontSize: 22, lineHeight: 28, fontWeight: 700, marginTop: 2 },
  todayNote: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 500 },
  todayIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: '#fff' },
  // Pulled up so the stat cards overlap the bottom of the gradient.
  body: { marginTop: -Spacing.four, paddingHorizontal: Spacing.three, gap: Spacing.four, maxWidth: 720, width: '100%', alignSelf: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { flexGrow: 1, flexBasis: '45%' },
  statCard: { gap: 6 },
  statValue: { marginTop: 6 },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  listCard: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  eventsScroller: { marginHorizontal: -Spacing.three },
  events: { gap: 12, paddingHorizontal: Spacing.three, paddingBottom: 6 },
  event: { width: 176, gap: 12 },
  dateBlock: { width: 48, height: 52, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  dateMonth: { fontSize: 10, fontWeight: 700, letterSpacing: 0.8 },
  dateDay: { fontSize: 20, lineHeight: 24, fontWeight: 700 },
  eventText: { gap: 2 },
  eventTitle: { fontWeight: 600 },
  emptyCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  loading: { alignItems: 'center', paddingVertical: Spacing.four },
  timeCell: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
