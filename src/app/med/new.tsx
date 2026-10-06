import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { addDays, compareTime, daysBetween, minutesOf, timeFromMinutes, timesEvery, todayKey } from '@/domain/time';
import type { DoseTime, FoodRule, Medication, MedForm, PillColor, Schedule } from '@/domain/types';
import { formatQty, scheduleSummary } from '@/domain/schedule';
import { requestPermission, hasPermission } from '@/notifications/engine';
import { useStore, type MedDraft } from '@/store/store';
import { isAndroid, useTheme } from '@/theme/theme';
import { fonts, pillColors } from '@/theme/tokens';
import { haptic } from '@/ui/haptics';
import { Icon, type IconName } from '@/ui/Icon';
import { Button, Card, Cell, Chip, Field, IconButton, Row, SectionLabel, Segmented, Stepper, Tap, Toggle } from '@/ui/kit';
import { PillGlyph } from '@/ui/PillGlyph';
import { MedThumb } from '@/ui/MedPhoto';
import { GrowBar, SlideIn } from '@/ui/motion';
import { photoUri, pickPhoto } from '@/photos/photos';
import { Footer, Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { DateField, TimeField } from '@/ui/TimeField';
import { toast } from '@/ui/Toast';

type Freq = 'daily' | 'hours' | 'weekdays' | 'interval' | 'asNeeded';

const FORMS: { value: MedForm; label: string }[] = [
  { value: 'tablet', label: 'Tablet' },
  { value: 'capsule', label: 'Capsule' },
  { value: 'softgel', label: 'Softgel' },
  { value: 'liquid', label: 'Liquid' },
  { value: 'injection', label: 'Injection' },
  { value: 'drops', label: 'Drops' },
  { value: 'inhaler', label: 'Inhaler' },
  { value: 'other', label: 'Other' },
];
// Most-used first: the first four are visible without scrolling the unit picker.
const UNITS = ['mg', 'mcg', 'ml', 'IU', 'g', '%'];
const COLORS = Object.keys(pillColors) as PillColor[];
const WEEK: { d: number; l: string }[] = [
  { d: 1, l: 'M' },
  { d: 2, l: 'T' },
  { d: 3, l: 'W' },
  { d: 4, l: 'T' },
  { d: 5, l: 'F' },
  { d: 6, l: 'S' },
  { d: 0, l: 'S' },
];
const WEEK_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function initialDraft(existing?: Medication): MedDraft {
  if (existing) return { ...existing };
  return {
    name: '',
    strength: '',
    unit: 'mg',
    form: 'tablet',
    color: 'chalk',
    food: 'any',
    instructions: '',
    notes: '',
    schedule: { kind: 'daily', times: [{ time: '08:00', qty: 1 }] },
    startDate: todayKey(),
    endDate: null,
    stock: null,
    refillAt: null,
    remindersOn: true,
    nagOn: true,
    paused: false,
  };
}

function freqOf(s: Schedule): Freq {
  if (s.kind === 'daily') return s.everyHours ? 'hours' : 'daily';
  return s.kind;
}

export default function MedEditor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useStore((s) => s.meds.find((m) => m.id === id));
  const [draft, setDraft] = useState<MedDraft>(() => initialDraft(existing));
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [saving, setSaving] = useState(false);
  const { c } = useTheme();
  const editing = !!existing;

  const set = (patch: Partial<MedDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const canNext = step === 0 ? draft.name.trim().length > 0 : step === 1 ? scheduleValid(draft.schedule) : true;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      // Times stay in the order they were edited until now, so rows don't jump under the user's finger.
      const schedule: Schedule =
        'times' in draft.schedule ? { ...draft.schedule, times: [...draft.schedule.times].sort((a, b) => compareTime(a.time, b.time)) } : draft.schedule;
      const med = await useStore.getState().saveMed({ ...draft, schedule, name: draft.name.trim(), strength: draft.strength.trim() });
      haptic.success();
      if (med.remindersOn && med.schedule.kind !== 'asNeeded' && !(await hasPermission())) await requestPermission().catch(() => false);
      toast(editing ? 'Changes saved' : `${med.name} added`, { icon: 'check' });
      close();
    } finally {
      setSaving(false);
    }
  };

  const titles = ['What are you\ntaking?', 'When do you\ntake it?', 'A few\ndetails'];
  const goTo = (n: number) => {
    haptic.press();
    setDir(n > step ? 1 : -1);
    setStep(n);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        bottomInset={28}
        footer={
          <Footer>
            <Row gap={10}>
              {step > 0 && <Button kind="ghost" label="Back" style={{ flex: 1 }} onPress={() => goTo(step - 1)} />}
              <Button
                kind="primary"
                label={step < 2 ? (step === 0 ? 'Continue to schedule' : 'Continue') : editing ? 'Save changes' : 'Save medication'}
                style={{ flex: 2 }}
                disabled={!canNext || saving}
                onPress={() => (step < 2 ? goTo(step + 1) : save())}
              />
            </Row>
          </Footer>
        }
      >
        <Row style={{ justifyContent: 'space-between', marginTop: 4, marginBottom: 22 }}>
          <IconButton name="x" label="Close" onPress={close} />
          <Row gap={5} accessible accessibilityLabel={`Step ${step + 1} of 3`}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ width: 26, height: 5, borderRadius: 3, backgroundColor: c.line, overflow: 'hidden' }}>
                <GrowBar pct={i <= step ? 100 : 0} color={c.ink} height={5} />
              </View>
            ))}
          </Row>
          <View style={{ width: 42, alignItems: 'flex-end' }}>
            {step > 0 && (photoUri(draft.photo) ? <MedThumb med={draft} size={38} round /> : <PillGlyph form={draft.form} color={draft.color} size={36} />)}
          </View>
        </Row>
        <SlideIn key={step} dir={dir}>
        <Text v="title" accessibilityRole="header" style={{ marginHorizontal: 2 }}>
          {editing && step === 0 ? `Edit ${existing!.name}` : titles[step]}
        </Text>

        {step === 0 && <StepWhat draft={draft} set={set} />}
        {step === 1 && <StepWhen draft={draft} set={set} />}
        {step === 2 && <StepDetails draft={draft} set={set} editing={editing} onDelete={() => confirmDelete(existing!)} />}
        </SlideIn>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function confirmDelete(med: Medication) {
  const run = async () => {
    await useStore.getState().deleteMed(med.id);
    toast(`${med.name} deleted`, { icon: 'trash' });
    router.dismissAll();
  };
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`Delete ${med.name} and its history?`)) run();
    return;
  }
  Alert.alert(`Delete ${med.name}?`, 'This removes the medication and its dose history from this phone. Pausing keeps the history.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: run },
  ]);
}

function scheduleValid(s: Schedule): boolean {
  if (s.kind === 'asNeeded') return s.qty > 0;
  if (s.kind === 'weekdays' && s.days.length === 0) return false;
  return s.times.length > 0 && s.times.every((t) => t.qty > 0);
}

type StepProps = { draft: MedDraft; set: (p: Partial<MedDraft>) => void };

function StepWhat({ draft, set }: StepProps) {
  const { c } = useTheme();
  return (
    <View>
      <Field
        label="Medication name"
        value={draft.name}
        onChangeText={(name) => set({ name })}
        placeholder="e.g. Metformin"
        autoFocus={!draft.name}
        autoCapitalize="words"
        returnKeyType="next"
        style={{ marginTop: 22 }}
        hint={isAndroid ? 'Brand or generic name, as on the box' : undefined}
      />
      <Row gap={10} style={{ marginTop: 12, alignItems: 'stretch' }}>
        <Field
          label="Strength"
          value={draft.strength}
          onChangeText={(strength) => set({ strength: strength.replace(/[^0-9.,/]/g, '') })}
          placeholder="500"
          keyboardType="decimal-pad"
          style={{ flex: 1 }}
        />
        <View style={[styles.unitCard, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Text v="caption">Unit</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4, paddingTop: 6 }} accessibilityRole="radiogroup">
            {UNITS.map((u) => {
              const on = draft.unit === u;
              return (
                <Pressable
                  key={u}
                  onPress={() => {
                    haptic.tap();
                    set({ unit: u });
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={u}
                  style={[styles.unit, on && { backgroundColor: c.ink }]}
                >
                  <Text v="caption" style={{ fontSize: 13.5, color: on ? c.bg : c.ink2, fontFamily: on ? fonts.semibold : fonts.medium }}>
                    {u}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Row>

      <SectionLabel>Form</SectionLabel>
      <View style={styles.grid}>
        {FORMS.map((f) => {
          const on = draft.form === f.value;
          return (
            <Tap
              key={f.value}
              onPress={() => set({ form: f.value, color: f.value === 'softgel' && draft.color === 'chalk' ? 'amber' : draft.color })}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={f.label}
              style={[styles.formTile, { backgroundColor: on ? c.accent : c.surface, borderColor: on ? c.accent : c.line }]}
            >
              <PillGlyph form={f.value} color={on ? draft.color : 'chalk'} size={34} />
              <Text v="caption" style={{ color: on ? c.accentInk : c.ink2, fontFamily: on ? fonts.semibold : fonts.medium, fontSize: 13 }}>
                {f.label}
              </Text>
            </Tap>
          );
        })}
      </View>

      <SectionLabel>Colour · helps you recognise it</SectionLabel>
      <Row gap={10} style={{ flexWrap: 'wrap', paddingHorizontal: 2 }}>
        <View style={[styles.preview, { backgroundColor: c.surface, borderColor: c.ink }]}>
          <PillGlyph form={draft.form} color={draft.color} size={46} />
        </View>
        {COLORS.map((k) => (
          <Pressable
            key={k}
            onPress={() => {
              haptic.tap();
              set({ color: k });
            }}
            accessibilityRole="radio"
            accessibilityLabel={pillColors[k].label}
            accessibilityState={{ selected: draft.color === k }}
            hitSlop={4}
            style={[
              styles.swatch,
              { backgroundColor: pillColors[k].main, borderColor: k === 'chalk' ? '#CDC4B0' : 'transparent' },
              draft.color === k && { borderWidth: 3, borderColor: c.ink },
            ]}
          />
        ))}
      </Row>

      <SectionLabel>Photo · easier than remembering a name</SectionLabel>
      <PhotoPicker draft={draft} set={set} />
    </View>
  );
}

/** Lets people recognise a medicine by sight: a photo of the tablet, strip or box. */
function PhotoPicker({ draft, set }: StepProps) {
  const { c } = useTheme();
  const uri = photoUri(draft.photo);
  const take = async (source: 'camera' | 'library') => {
    try {
      const name = await pickPhoto(source);
      if (name) {
        haptic.success();
        set({ photo: name });
      }
    } catch {
      toast('That photo could not be saved. Try again.', { icon: 'info' });
    }
  };
  if (uri) {
    return (
      <Row gap={14} style={[styles.photoCard, { backgroundColor: c.surface, borderColor: c.line }]}>
        <MedThumb med={draft} size={88} zoomable />
        <View style={{ flex: 1, gap: 8 }}>
          <Text v="bodyStrong" tone="ink">
            Shown on reminders and Today
          </Text>
          <Row gap={8}>
            <Chip label="Retake" icon="camera" onPress={() => take('camera')} />
            <Chip label="Remove" icon="trash" onPress={() => set({ photo: null })} />
          </Row>
        </View>
      </Row>
    );
  }
  const sources: { src: 'camera' | 'library'; label: string; icon: IconName }[] = [
    { src: 'camera', label: 'Take photo', icon: 'camera' },
    { src: 'library', label: 'Choose photo', icon: 'image' },
  ];
  return (
    <View>
      <Row gap={10}>
        {sources.map(({ src, label, icon }) => (
          <Tap
            key={src}
            onPress={() => take(src)}
            hapticKind="press"
            accessibilityLabel={label}
            style={[styles.photoBtn, { backgroundColor: c.surface, borderColor: c.line }]}
          >
            <View style={[styles.photoIcon, { backgroundColor: c.accentSoft }]}>
              <Icon name={icon} size={22} tone="accent" />
            </View>
            <Text v="headline" style={{ marginTop: 10 }}>
              {label}
            </Text>
          </Tap>
        ))}
      </Row>
      <Text v="caption" style={{ marginTop: 8, marginHorizontal: 4, lineHeight: 17 }}>
        Photograph the tablet, strip or box. Great for anyone who finds medicine names hard to remember.
      </Text>
    </View>
  );
}

function StepWhen({ draft, set }: StepProps) {
  const { c } = useTheme();
  const s = draft.schedule;
  const freq = freqOf(s);
  const times: DoseTime[] = 'times' in s ? s.times : [];
  const [hours, setHours] = useState(s.kind === 'daily' && s.everyHours ? s.everyHours : 8);

  const setSchedule = (next: Schedule) => set({ schedule: next });
  const setTimes = (t: DoseTime[]) => {
    if (s.kind === 'asNeeded') return;
    setSchedule({ ...s, times: t, ...(s.kind === 'daily' ? { everyHours: undefined } : {}) } as Schedule);
  };

  const changeFreq = (f: Freq) => {
    const base = times.length ? times : [{ time: '08:00', qty: 1 }];
    if (f === 'daily') setSchedule({ kind: 'daily', times: base });
    if (f === 'hours') setSchedule({ kind: 'daily', everyHours: hours, times: timesEvery(hours, base[0].time).map((time) => ({ time, qty: base[0].qty })) });
    if (f === 'weekdays') setSchedule({ kind: 'weekdays', days: [1, 2, 3, 4, 5], times: base });
    if (f === 'interval') setSchedule({ kind: 'interval', everyDays: 2, times: base });
    if (f === 'asNeeded') setSchedule({ kind: 'asNeeded', qty: base[0].qty });
  };

  const freqs: { v: Freq; l: string; icon: IconName }[] = [
    { v: 'daily', l: 'Every day', icon: 'sun' },
    { v: 'hours', l: 'Every few hours', icon: 'clock' },
    { v: 'weekdays', l: 'Specific days', icon: 'calendar' },
    { v: 'interval', l: 'Every few days', icon: 'restore' },
    { v: 'asNeeded', l: 'As needed', icon: 'heart' },
  ];

  const courseDays = draft.endDate ? daysBetween(draft.startDate, draft.endDate) + 1 : null;

  return (
    <View>
      <View style={[styles.chipGrid, { marginTop: 20 }]}>
        {freqs.map((f, i) => (
          // Two equal columns; the odd one out spans the full width so no row is ragged.
          <View key={f.v} style={{ width: i === freqs.length - 1 && freqs.length % 2 ? '100%' : '48.6%' }}>
            <Chip fill label={f.l} icon={f.icon} on={freq === f.v} onPress={() => changeFreq(f.v)} />
          </View>
        ))}
      </View>

      {freq === 'hours' && (
        <View style={{ marginTop: 16 }}>
          <Segmented
            options={[4, 6, 8, 12].map((h) => ({ value: String(h), label: `${h} h` }))}
            value={String(hours)}
            onChange={(v) => {
              const h = Number(v);
              setHours(h);
              setSchedule({ kind: 'daily', everyHours: h, times: timesEvery(h, times[0]?.time ?? '08:00').map((time) => ({ time, qty: times[0]?.qty ?? 1 })) });
            }}
          />
        </View>
      )}

      {s.kind === 'weekdays' && (
        <Row gap={6} style={{ marginTop: 16, justifyContent: 'space-between' }}>
          {WEEK.map(({ d, l }) => {
            const on = s.days.includes(d);
            return (
              <Tap
                key={d}
                onPress={() => setSchedule({ ...s, days: on ? s.days.filter((x) => x !== d) : [...s.days, d] })}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={WEEK_NAMES[d]}
                style={[styles.day, { backgroundColor: on ? c.ink : c.surface2 }]}
              >
                <Text v="headline" style={{ color: on ? c.bg : c.ink2, fontSize: 15 }}>
                  {l}
                </Text>
              </Tap>
            );
          })}
        </Row>
      )}

      {s.kind === 'interval' && (
        <Card style={{ marginTop: 16 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text v="bodyStrong" tone="ink">
              Every {s.everyDays} days
            </Text>
            <Stepper value={s.everyDays} min={2} max={60} label="days between doses" onChange={(everyDays) => setSchedule({ ...s, everyDays })} />
          </Row>
        </Card>
      )}

      {s.kind === 'asNeeded' ? (
        <Card style={{ marginTop: 16, gap: 16 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text v="bodyStrong" tone="ink">
              Dose
            </Text>
            <Row gap={10}>
              <Text v="sub">{formatQty(draft as Medication, s.qty)}</Text>
              <Stepper value={s.qty} min={0.5} step={0.5} label="dose" onChange={(qty) => setSchedule({ ...s, qty })} />
            </Row>
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text v="bodyStrong" tone="ink">
              Max per day
            </Text>
            <Stepper value={s.maxPerDay ?? 0} min={0} max={24} label="maximum per day" onChange={(m) => setSchedule({ ...s, maxPerDay: m || undefined })} />
          </Row>
        </Card>
      ) : (
        <>
          <SectionLabel>Dose times</SectionLabel>
          <Card padded={false}>
            {times.map((t, i) => (
              <View key={`dose-${i}`} style={[styles.timeRow, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
                <TimeField
                  label={`Dose ${i + 1} time`}
                  value={t.time}
                  onChange={(time) => setTimes(times.map((x, j) => (j === i ? { ...x, time } : x)))}
                />
                <Text v="sub" style={{ flex: 1, textAlign: 'right' }} numberOfLines={1}>
                  {formatQty(draft as Medication, t.qty)}
                </Text>
                <Stepper value={t.qty} min={0.5} step={0.5} max={20} label={`dose ${i + 1} amount`} onChange={(qty) => setTimes(times.map((x, j) => (j === i ? { ...x, qty } : x)))} />
                {times.length > 1 && (
                  <Tap onPress={() => setTimes(times.filter((_, j) => j !== i))} hitSlop={8} accessibilityLabel={`Remove dose ${i + 1}`} style={{ padding: 4 }}>
                    <Icon name="x" size={18} tone="ink3" />
                  </Tap>
                )}
              </View>
            ))}
            {freq !== 'hours' && times.length < 12 && (
              <Pressable
                onPress={() => {
                  haptic.tap();
                  const last = times.at(-1)?.time ?? '08:00';
                  setTimes([...times, { time: timeFromMinutes(Math.min(minutesOf(last) + 240, 22 * 60)), qty: times.at(-1)?.qty ?? 1 }]);
                }}
                accessibilityRole="button"
                style={[styles.timeRow, { borderTopWidth: times.length ? 1 : 0, borderTopColor: c.line }]}
              >
                <Icon name="plus" size={18} tone="accent" stroke={2.2} />
                <Text v="button" tone="accent" style={{ fontSize: 15 }}>
                  Add a time
                </Text>
              </Pressable>
            )}
          </Card>
        </>
      )}

      <SectionLabel>Duration</SectionLabel>
      <Row gap={10}>
        <DateField label="Starts" value={draft.startDate} onChange={(startDate) => set({ startDate, endDate: draft.endDate && draft.endDate < startDate ? startDate : draft.endDate })} />
        {draft.endDate ? (
          <DateField label="Ends" value={draft.endDate} minimum={draft.startDate} onChange={(endDate) => set({ endDate })} />
        ) : (
          <View style={[styles.ongoing, { borderColor: c.line, backgroundColor: c.surface }]}>
            <Text v="caption">Ends</Text>
            <Text v="bodyStrong" tone="ink" style={{ marginTop: 6, fontSize: 16 }}>
              Ongoing
            </Text>
          </View>
        )}
      </Row>
      <View style={[styles.chipGrid, { marginTop: 12 }]}>
        <View style={{ width: '31.8%' }}>
          <Chip fill label="Ongoing" on={!draft.endDate} onPress={() => set({ endDate: null })} />
        </View>
        {[5, 7, 10, 14, 30].map((n) => (
          <View key={n} style={{ width: '31.8%' }}>
            <Chip fill label={`${n} days`} on={courseDays === n} onPress={() => set({ endDate: addDays(draft.startDate, n - 1) })} />
          </View>
        ))}
      </View>
      {s.kind !== 'asNeeded' && (
        <Text v="caption" style={{ marginTop: 12, marginLeft: 4 }}>
          {scheduleSummary(draft as Medication)}
          {courseDays ? ` · ${courseDays}-day course` : ''}
        </Text>
      )}
    </View>
  );
}

function StepDetails({ draft, set, editing, onDelete }: StepProps & { editing: boolean; onDelete: () => void }) {
  const tracking = draft.stock != null;
  return (
    <View>
      <SectionLabel>How to take it</SectionLabel>
      <Segmented<FoodRule>
        options={[
          { value: 'before', label: 'Before food' },
          { value: 'with', label: 'With food' },
          { value: 'after', label: 'After food' },
          { value: 'any', label: 'Any time' },
        ]}
        value={draft.food}
        onChange={(food) => set({ food })}
      />
      <Field
        label="Instructions (optional)"
        value={draft.instructions}
        onChangeText={(instructions) => set({ instructions })}
        placeholder="e.g. Swallow whole with water"
        style={{ marginTop: 12 }}
      />
      <Field
        label="Notes (optional)"
        value={draft.notes}
        onChangeText={(notes) => set({ notes })}
        placeholder="e.g. Prescribed by Dr. Menon"
        multiline
        style={{ marginTop: 12 }}
      />

      <SectionLabel>Supply &amp; refills</SectionLabel>
      <Card padded={false}>
        <Cell
          first
          icon="bottle"
          title="Track how many are left"
          subtitle="Counts down as you take doses"
          right={<Toggle label="Track supply" value={tracking} onChange={(v) => set({ stock: v ? 30 : null, refillAt: v ? 7 : null })} />}
        />
        {tracking && (
          <>
            <Cell
              title="Currently left"
              right={<Stepper value={draft.stock ?? 0} min={0} max={9999} label="units left" onChange={(stock) => set({ stock })} />}
            />
            <Cell
              title="Remind me to refill at"
              right={<Stepper value={draft.refillAt ?? 0} min={0} max={500} label="refill threshold" onChange={(refillAt) => set({ refillAt })} />}
            />
          </>
        )}
      </Card>

      {draft.schedule.kind !== 'asNeeded' && (
        <>
          <SectionLabel>Reminders</SectionLabel>
          <Card padded={false}>
            <Cell first icon="bell" title="Remind me at dose time" right={<Toggle label="Remind me at dose time" value={draft.remindersOn} onChange={(remindersOn) => set({ remindersOn })} />} />
            <Cell
              icon="snooze"
              title="Nudge again if unmarked"
              subtitle="A gentle follow-up so nothing slips"
              right={<Toggle label="Nudge again if unmarked" value={draft.nagOn && draft.remindersOn} onChange={(nagOn) => set({ nagOn })} />}
            />
          </Card>
        </>
      )}

      {editing && (
        <Card padded={false} style={{ marginTop: 26 }}>
          <Cell first icon="trash" title="Delete medication" danger onPress={onDelete} />
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  photoBtn: { flex: 1, borderRadius: 20, borderWidth: 1, paddingVertical: 16, alignItems: 'center' },
  photoIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  photoCard: { borderRadius: 20, borderWidth: 1, padding: 12 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  unitCard: { flex: 1.25, borderRadius: 18, borderWidth: 1, paddingLeft: 14, paddingRight: 8, paddingTop: 12, paddingBottom: 10, justifyContent: 'space-between' },
  unit: { height: 30, minWidth: 34, paddingHorizontal: 9, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  formTile: { width: '22.6%', aspectRatio: 0.92, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  preview: { width: 52, height: 52, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 1 },
  day: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, minHeight: 60 },
  ongoing: { flex: 1, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
});
