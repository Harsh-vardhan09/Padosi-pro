import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { ScrollView } from 'react-native-css/components';
import { asApiError } from '../api/client';
import { saveProfile } from '../api/profile';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import {
  ADDRESS_MAX,
  EMPTY_PROFILE,
  FULL_NAME_MAX,
  hasErrors,
  MOBILE_DIGITS,
  PROFILE_VALIDATORS,
  validateProfile,
  type ProfileErrors,
  type ProfileField,
  type ProfileValues,
} from '../profile/validation';

type ProfileScreenProps = {
  token: string;
  onSaved: () => void;
};

export function ProfileScreen({ token, onSaved }: ProfileScreenProps) {
  const [values, setValues] = useState<ProfileValues>(EMPTY_PROFILE);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function change(field: ProfileField, value: string): void {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function validateOnBlur(field: ProfileField): void {
    setErrors((current) => ({ ...current, [field]: PROFILE_VALIDATORS[field](values[field]) }));
  }

  async function submit(): Promise<void> {
    setFormError(null);
    const found = validateProfile(values);
    setErrors(found);
    if (hasErrors(found)) return;

    setSaving(true);
    try {
      await saveProfile(token, {
        fullName: values.fullName.trim(),
        mobile: `+91${values.mobile}`,
        address: values.address.trim(),
        businessName: values.businessName.trim(),
      });
      onSaved();
    } catch (caught) {
      const error = asApiError(caught);
      // The server keys `fields` by the same names as this form, so it maps straight across.
      setErrors(error.fields);
      setFormError(Object.keys(error.fields).length === 0 ? error.message : null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-8 px-6 py-8"
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-1">
            <Text className="text-2xl font-semibold text-ink">Tell us about you</Text>
            <Text className="text-base text-muted">
              We use this to reach you and to know where your tasks happen.
            </Text>
          </View>

          <View className="gap-4">
            {formError === null ? null : <Banner message={formError} tone="error" />}

            <TextField
              autoCapitalize="words"
              autoComplete="name"
              editable={!saving}
              error={errors.fullName ?? null}
              label="Full name"
              maxLength={FULL_NAME_MAX}
              onBlur={() => validateOnBlur('fullName')}
              onChangeText={(next) => change('fullName', next)}
              textContentType="name"
              value={values.fullName}
            />

            <TextField
              autoComplete="tel-national"
              editable={!saving}
              error={errors.mobile ?? null}
              keyboardType="number-pad"
              label="Mobile number"
              leading={<Text className="text-base font-medium text-ink">+91</Text>}
              maxLength={MOBILE_DIGITS}
              onBlur={() => validateOnBlur('mobile')}
              onChangeText={(next) =>
                change('mobile', next.replace(/[^0-9]/gu, '').slice(0, MOBILE_DIGITS))
              }
              value={values.mobile}
            />

            <TextField
              editable={!saving}
              error={errors.address ?? null}
              label="Address"
              maxLength={ADDRESS_MAX}
              multiline
              onBlur={() => validateOnBlur('address')}
              onChangeText={(next) => change('address', next)}
              textAlignVertical="top"
              value={values.address}
            />

            <TextField
              autoCapitalize="words"
              editable={!saving}
              error={errors.businessName ?? null}
              hint="Leave blank if this is a home, not a business."
              label="Business name (optional)"
              onBlur={() => validateOnBlur('businessName')}
              onChangeText={(next) => change('businessName', next)}
              value={values.businessName}
            />

            <Button label="Save and continue" loading={saving} onPress={submit} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
