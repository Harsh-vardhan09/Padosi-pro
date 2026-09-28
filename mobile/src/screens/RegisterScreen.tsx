import { useState } from 'react';
import { View } from 'react-native';
import { register } from '../api/auth';
import { asApiError } from '../api/client';
import {
  normaliseEmail,
  validateConfirmPassword,
  validateEmail,
  validatePassword,
} from '../auth/validation';
import { AuthLayout } from '../components/AuthLayout';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { TextLink } from '../components/TextLink';
import type { VerifyTarget } from './VerifyScreen';

type RegisterScreenProps = {
  onRegistered: (target: VerifyTarget) => void;
  onGoToLogin: () => void;
};

export function RegisterScreen({ onRegistered, onGoToLogin }: RegisterScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function validateAll(): boolean {
    const emailMessage = validateEmail(email);
    const passwordMessage = validatePassword(password);
    const confirmMessage = validateConfirmPassword(password, confirm);

    setEmailError(emailMessage);
    setPasswordError(passwordMessage);
    setConfirmError(confirmMessage);

    return emailMessage === null && passwordMessage === null && confirmMessage === null;
  }

  async function submit(): Promise<void> {
    setFormError(null);
    if (!validateAll()) return;

    setSubmitting(true);
    try {
      const registered = await register({ email: normaliseEmail(email), password });
      onRegistered({
        email: registered.email,
        otpSent: registered.otpSent,
        resendAvailableAt: registered.resendAvailableAt,
      });
    } catch (caught) {
      const error = asApiError(caught);
      // EMAIL_TAKEN is about the email even though the server sends it without a `fields` entry.
      const emailMessage =
        error.fields.email ?? (error.code === 'EMAIL_TAKEN' ? error.message : null);
      const passwordMessage = error.fields.password ?? null;

      setEmailError(emailMessage);
      setPasswordError(passwordMessage);
      setFormError(emailMessage === null && passwordMessage === null ? error.message : null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="We will email you a 6-digit code to confirm it is you."
      footer={
        <TextLink
          disabled={submitting}
          label="Already have an account? Log in"
          onPress={onGoToLogin}
        />
      }
    >
      <View className="gap-4">
        {formError === null ? null : <Banner message={formError} tone="error" />}

        <TextField
          autoCapitalize="none"
          autoComplete="email"
          editable={!submitting}
          error={emailError}
          keyboardType="email-address"
          label="Email"
          onBlur={() => setEmailError(validateEmail(email))}
          onChangeText={setEmail}
          textContentType="emailAddress"
          value={email}
        />

        <TextField
          autoCapitalize="none"
          autoComplete="new-password"
          editable={!submitting}
          error={passwordError}
          label="Password"
          onBlur={() => setPasswordError(validatePassword(password))}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          textContentType="newPassword"
          trailing={
            <TextLink
              label={showPassword ? 'Hide' : 'Show'}
              onPress={() => setShowPassword(!showPassword)}
            />
          }
          value={password}
        />

        <TextField
          autoCapitalize="none"
          editable={!submitting}
          error={confirmError}
          label="Confirm password"
          onBlur={() => setConfirmError(validateConfirmPassword(password, confirm))}
          onChangeText={setConfirm}
          onSubmitEditing={submit}
          returnKeyType="go"
          secureTextEntry={!showPassword}
          value={confirm}
        />

        <Button label="Create account" loading={submitting} onPress={submit} />
      </View>
    </AuthLayout>
  );
}
