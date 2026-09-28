import type { ReactNode } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string | null;
  trailing?: ReactNode;
};

export function TextField({ label, error = null, trailing, ...input }: TextFieldProps) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-ink">{label}</Text>

      <View
        className={`h-14 flex-row items-center gap-3 rounded-xl border bg-white px-4 ${
          error === null ? 'border-line' : 'border-danger'
        }`}
      >
        <TextInput accessibilityLabel={label} className="flex-1 text-base text-ink" {...input} />
        {trailing}
      </View>

      {error === null ? null : (
        <Text accessibilityLiveRegion="polite" className="text-sm text-danger">
          {error}
        </Text>
      )}
    </View>
  );
}
