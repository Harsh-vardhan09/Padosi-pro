import { Pressable, Text } from 'react-native';

type TextLinkProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export function TextLink({ label, onPress, disabled = false }: TextLinkProps) {
  return (
    <Pressable
      accessibilityRole="link"
      className={disabled ? 'opacity-50' : ''}
      disabled={disabled}
      onPress={onPress}
    >
      <Text className="text-center text-base font-semibold text-primary">{label}</Text>
    </Pressable>
  );
}
