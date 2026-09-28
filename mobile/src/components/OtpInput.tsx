import { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

export const OTP_LENGTH = 6;

type OtpInputProps = {
  value: string;
  onChangeText: (value: string) => void;
  editable?: boolean;
  invalid?: boolean;
};

/**
 * One transparent input laid over six display boxes, so paste, backspace and auto-advance stay the
 * platform's own behaviour instead of six refs juggling focus between themselves.
 */
export function OtpInput({
  value,
  onChangeText,
  editable = true,
  invalid = false,
}: OtpInputProps) {
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  function boxClassName(index: number): string {
    const active = focused && index === Math.min(value.length, OTP_LENGTH - 1);
    if (invalid) return 'border-danger';
    return active ? 'border-primary' : 'border-line';
  }

  return (
    <Pressable accessible={false} className="relative" onPress={() => input.current?.focus()}>
      <View className="flex-row gap-2">
        {Array.from({ length: OTP_LENGTH }, (_, index) => (
          <View
            key={index}
            className={`h-14 flex-1 items-center justify-center rounded-xl border bg-white ${boxClassName(index)}`}
          >
            <Text className="text-2xl font-semibold text-ink">{value[index] ?? ''}</Text>
          </View>
        ))}
      </View>

      <TextInput
        accessibilityLabel={`${OTP_LENGTH}-digit verification code`}
        autoComplete="sms-otp"
        autoFocus
        className="absolute inset-0 opacity-0"
        editable={editable}
        keyboardType="number-pad"
        maxLength={OTP_LENGTH}
        onBlur={() => setFocused(false)}
        onChangeText={(next) => onChangeText(next.replace(/[^0-9]/gu, '').slice(0, OTP_LENGTH))}
        onFocus={() => setFocused(true)}
        ref={input}
        textContentType="oneTimeCode"
        value={value}
      />
    </Pressable>
  );
}
