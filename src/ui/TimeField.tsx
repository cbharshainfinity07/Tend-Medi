import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useMemo } from 'react';
import { Platform, View } from 'react-native';
import { dateKey, parseDateKey } from '@/domain/time';
import { formatDate, formatTime } from '@/lib/format';
import { useTheme } from '@/theme/theme';
import { fonts } from '@/theme/tokens';
import { Tap } from './kit';
import { Text } from './Text';

const toDate = (hhmm: string) => {
  const d = new Date();
  const [h, m] = hhmm.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
};
const fromDate = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export function TimeField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const { c, dark } = useTheme();
  // A stable Date per value: handing the native picker a fresh object every render makes iOS close its popover.
  const date = useMemo(() => toDate(value), [value]);
  if (Platform.OS === 'ios') {
    return (
      <DateTimePicker
        value={date}
        mode="time"
        display="compact"
        minuteInterval={5}
        themeVariant={dark ? 'dark' : 'light'}
        accentColor={c.accent}
        accessibilityLabel={label}
        onChange={(_e: DateTimePickerEvent, d?: Date) => d && onChange(fromDate(d))}
      />
    );
  }
  return (
    <Tap
      accessibilityLabel={`${label}, ${formatTime(value)}. Change`}
      onPress={() =>
        DateTimePickerAndroid.open({
          value: toDate(value),
          mode: 'time',
          onChange: (e, d) => e.type === 'set' && d && onChange(fromDate(d)),
        })
      }
      style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: c.surface2 }}
    >
      <Text v="mono" style={{ fontSize: 20, lineHeight: 26, fontFamily: fonts.mono }}>
        {formatTime(value)}
      </Text>
    </Tap>
  );
}

export function DateField({
  value,
  onChange,
  label,
  minimum,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  minimum?: string;
}) {
  const { c, dark } = useTheme();
  const min = minimum ? parseDateKey(minimum) : undefined;
  return (
    <View style={{ flex: 1, backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.line, paddingHorizontal: 14, paddingVertical: 10 }}>
      <Text v="caption">{label}</Text>
      {Platform.OS === 'ios' ? (
        <View style={{ alignItems: 'flex-start', marginTop: 4, marginLeft: -8 }}>
          <DateTimePicker
            value={parseDateKey(value)}
            mode="date"
            display="compact"
            minimumDate={min}
            themeVariant={dark ? 'dark' : 'light'}
            accentColor={c.accent}
            accessibilityLabel={label}
            onChange={(_e: DateTimePickerEvent, d?: Date) => d && onChange(dateKey(d))}
          />
        </View>
      ) : (
        <Tap
          accessibilityLabel={`${label}, ${formatDate(value)}. Change`}
          onPress={() =>
            DateTimePickerAndroid.open({
              value: parseDateKey(value),
              mode: 'date',
              minimumDate: min,
              onChange: (e, d) => e.type === 'set' && d && onChange(dateKey(d)),
            })
          }
          style={{ paddingTop: 6 }}
        >
          <Text v="bodyStrong" tone="ink" style={{ fontSize: 16 }}>
            {formatDate(value, { weekday: 'short', day: 'numeric', month: 'short' })}
          </Text>
        </Tap>
      )}
    </View>
  );
}
