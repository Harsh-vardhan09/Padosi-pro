import { Pressable, Text } from 'react-native';
import { ActivityIndicator } from 'react-native-css/components';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
}: ButtonProps) {
  const blocked = disabled || loading;
  const primary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy: loading }}
      className={`h-14 flex-row items-center justify-center gap-2 rounded-xl ${
        primary ? 'bg-primary' : 'border border-primary bg-white'
      } ${blocked ? 'opacity-50' : ''}`}
      disabled={blocked}
      onPress={onPress}
    >
      {loading ? (
        <ActivityIndicator className={primary ? 'text-white' : 'text-primary'} size="small" />
      ) : null}
      <Text className={`text-base font-semibold ${primary ? 'text-white' : 'text-primary'}`}>
        {label}
      </Text>
    </Pressable>
  );
}
