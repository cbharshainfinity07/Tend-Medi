// Web preview fallback: stepper controls instead of native pickers.
import { View } from 'react-native';
import { addDays, minutesOf, timeFromMinutes } from '@/domain/time';
import { formatDate, formatTime } from '@/lib/format';
import { useTheme } from '@/theme/theme';
import { Icon } from './Icon';
import { Row, Tap } from './kit';
import { Text } from './Text';

function Arrow({ dir, onPress, label }: { dir: 'back' | 'chevron'; onPress: () => void; label: string }) {
  const { c } = useTheme();
  return (
    <Tap onPress={onPress} accessibilityLabel={label} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={dir} size={14} stroke={2.2} />
    </Tap>
  );
}

export function TimeField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <Row gap={6}>
      <Arrow dir="back" label={`Earlier ${label}`} onPress={() => onChange(timeFromMinutes(minutesOf(value) - 15))} />
      <Text v="mono" style={{ fontSize: 19, minWidth: 64, textAlign: 'center' }}>
        {formatTime(value)}
      </Text>
      <Arrow dir="chevron" label={`Later ${label}`} onPress={() => onChange(timeFromMinutes(minutesOf(value) + 15))} />
    </Row>
  );
}

export function DateField({ value, onChange, label, minimum }: { value: string; onChange: (v: string) => void; label: string; minimum?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.line, paddingHorizontal: 14, paddingVertical: 10 }}>
      <Text v="caption">{label}</Text>
      <Row gap={6} style={{ marginTop: 6, justifyContent: 'space-between' }}>
        <Arrow dir="back" label={`Previous day`} onPress={() => (!minimum || addDays(value, -1) >= minimum) && onChange(addDays(value, -1))} />
        <Text v="bodyStrong" tone="ink" style={{ fontSize: 14.5 }}>
          {formatDate(value, { day: 'numeric', month: 'short' })}
        </Text>
        <Arrow dir="chevron" label={`Next day`} onPress={() => onChange(addDays(value, 1))} />
      </Row>
    </View>
  );
}
