import type { ReactNode } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string | null;
  hint?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
};

export function TextField({
  label,
  error = null,
  hint,
  leading,
  trailing,
  ...input
}: TextFieldProps) {
  const multiline = input.multiline === true;

  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-ink">{label}</Text>

      <View
        className={`flex-row gap-3 rounded-xl border bg-white px-4 ${
          multiline ? 'min-h-28 items-start py-3' : 'h-14 items-center'
        } ${error === null ? 'border-line' : 'border-danger'}`}
      >
        {leading}
        <TextInput accessibilityLabel={label} className="flex-1 text-base text-ink" {...input} />
        {trailing}
      </View>

      {error !== null ? (
        <Text accessibilityLiveRegion="polite" className="text-sm text-danger">
          {error}
        </Text>
      ) : null}

      {error === null && hint !== undefined ? (
        <Text className="text-sm text-muted">{hint}</Text>
      ) : null}
    </View>
  );
}
