import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Avatar, IconChip } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ContactsDeniedError, loadContacts, openAppSettings, type ContactPerson } from '@/lib/contacts';
import { selectHaptic } from '@/lib/haptics';
import { formatPhone } from '@/lib/phone';

type State =
  | { status: 'loading' }
  | { status: 'ready'; contacts: ContactPerson[] }
  | { status: 'denied'; canAskAgain: boolean; message: string }
  | { status: 'error'; message: string };

type ContactPickerProps = { onClose: () => void; onConfirm: (people: ContactPerson[]) => void; max: number };

/** A full-screen, searchable multi-select of the address book. Mount it only while open, so it loads fresh each time. */
export function ContactPicker({ onClose, onConfirm, max }: ContactPickerProps) {
  const theme = useTheme();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadContacts().then(
      (contacts) => setState({ status: 'ready', contacts }),
      (err: Error) =>
        setState(
          err instanceof ContactsDeniedError
            ? { status: 'denied', canAskAgain: err.canAskAgain, message: err.message }
            : { status: 'error', message: err.message || 'Could not read your contacts.' },
        ),
    );
  }, [attempt]);

  const contacts = useMemo(() => (state.status === 'ready' ? state.contacts : []), [state]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    const digits = q.replace(/\D/g, '');
    return contacts.filter((c) => c.name.toLowerCase().includes(q) || (digits.length >= 3 && c.phone?.includes(digits)));
  }, [contacts, query]);
  const selectableVisible = visible.filter((c) => c.phone);
  const allVisibleSelected = selectableVisible.length > 0 && selectableVisible.every((c) => selected.has(c.id));

  const toggle = (id: string) => {
    selectHaptic();
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < max) next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    selectHaptic();
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) selectableVisible.forEach((c) => next.delete(c.id));
      else for (const c of selectableVisible) if (next.size < max) next.add(c.id);
      return next;
    });
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ThemedView style={styles.flex}>
        <SafeAreaView style={styles.flex} edges={['top', 'left', 'right', 'bottom']}>
          <View style={styles.header}>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
              <ThemedText style={{ color: theme.primary }}>Cancel</ThemedText>
            </Pressable>
            <View style={styles.headerTitle}>
              <ThemedText type="heading">Add from contacts</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {selected.size} selected{selected.size >= max ? ` (max ${max})` : ''}
              </ThemedText>
            </View>
            <View style={styles.headerSpacer} />
          </View>

          {state.status === 'loading' && (
            <View style={styles.centered}>
              <ActivityIndicator color={theme.primary} />
              <ThemedText type="small" themeColor="textSecondary">
                Reading your contacts…
              </ThemedText>
            </View>
          )}

          {(state.status === 'denied' || state.status === 'error') && (
            <View style={styles.centered}>
              <IconChip name={state.status === 'denied' ? 'lock-closed' : 'alert-circle'} tone="warning" size={60} />
              <ThemedText type="title" style={styles.center}>
                {state.status === 'denied' ? 'Allow contacts access' : 'Something went wrong'}
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.center}>
                {state.message} Your contacts stay on your phone; only the people you choose are added.
              </ThemedText>
              <View style={styles.centerActions}>
                {state.status === 'denied' && !state.canAskAgain ? (
                  <Button title="Open Settings" icon="settings-outline" onPress={openAppSettings} />
                ) : (
                  <Button
                    title="Try again"
                    icon="refresh"
                    onPress={() => {
                      setState({ status: 'loading' });
                      setAttempt((n) => n + 1);
                    }}
                  />
                )}
              </View>
            </View>
          )}

          {state.status === 'ready' && (
            <>
              <View style={styles.searchWrap}>
                <TextField
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search name or number"
                  autoCorrect={false}
                  returnKeyType="search"
                  leading={<Ionicons name="search" size={18} color={theme.textSecondary} style={styles.searchIcon} />}
                />
                {selectableVisible.length > 0 && (
                  <Pressable accessibilityRole="button" onPress={toggleAllVisible} style={styles.selectAll} hitSlop={6}>
                    <Ionicons name={allVisibleSelected ? 'checkbox' : 'square-outline'} size={20} color={theme.primary} />
                    <ThemedText type="smallBold" style={{ color: theme.primary }}>
                      {allVisibleSelected ? 'Clear these' : `Select ${query ? 'these' : 'all'} (${selectableVisible.length})`}
                    </ThemedText>
                  </Pressable>
                )}
              </View>

              <FlatList
                data={visible}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={20}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                  <ThemedText type="small" themeColor="textSecondary" style={[styles.center, styles.empty]}>
                    {contacts.length === 0 ? 'No contacts with phone numbers on this phone.' : 'No matches.'}
                  </ThemedText>
                }
                renderItem={({ item }) => {
                  const isSelected = selected.has(item.id);
                  const usable = !!item.phone;
                  return (
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isSelected, disabled: !usable }}
                      accessibilityLabel={`${item.name}${usable ? '' : ', no usable mobile number'}`}
                      disabled={!usable}
                      onPress={() => toggle(item.id)}
                      style={({ pressed }) => [
                        styles.row,
                        isSelected && { backgroundColor: theme.primarySoft },
                        !usable && { opacity: 0.45 },
                        pressed && { opacity: 0.7 },
                      ]}>
                      {isSelected ? (
                        <View style={[styles.checkAvatar, { backgroundColor: theme.primary }]}>
                          <Ionicons name="checkmark" size={22} color={theme.onPrimary} />
                        </View>
                      ) : (
                        <Avatar name={item.name} size={42} />
                      )}
                      <View style={styles.flex}>
                        <ThemedText numberOfLines={1} style={styles.name}>
                          {item.name}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                          {item.phone ? formatPhone(item.phone) : 'No usable mobile number'}
                          {item.phone && !item.lname ? ' · no last name' : ''}
                        </ThemedText>
                      </View>
                      <Ionicons
                        name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={24}
                        color={isSelected ? theme.primary : theme.border}
                      />
                    </Pressable>
                  );
                }}
              />

              <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
                <Button
                  title={selected.size ? `Review ${selected.size} ${selected.size === 1 ? 'person' : 'people'}` : 'Choose people to add'}
                  icon="arrow-forward"
                  disabled={selected.size === 0}
                  onPress={() => onConfirm(contacts.filter((c) => selected.has(c.id)))}
                />
              </View>
            </>
          )}
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  headerTitle: { flex: 1, alignItems: 'center' },
  headerSpacer: { width: 52 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.four },
  centerActions: { alignSelf: 'stretch', marginTop: Spacing.two },
  searchWrap: { paddingHorizontal: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.two },
  searchIcon: { marginRight: 8 },
  selectAll: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 },
  list: { paddingHorizontal: Spacing.two, paddingBottom: Spacing.four },
  empty: { paddingVertical: Spacing.five },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.two, paddingVertical: 10, borderRadius: Radius.md },
  checkAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  name: { fontWeight: 500 },
  footer: { padding: Spacing.three, borderTopWidth: StyleSheet.hairlineWidth },
});
