import { useState } from 'react';
import { View } from 'react-native';
import { login } from '../api/auth';
import { asApiError, detailString } from '../api/client';
import { useSession } from '../auth/SessionProvider';
import { normaliseEmail, validateEmail, validatePassword } from '../auth/validation';
import { AuthLayout } from '../components/AuthLayout';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { TextLink } from '../components/TextLink';
import type { VerifyTarget } from './VerifyScreen';

type LoginScreenProps = {
  onNeedsVerification: (target: VerifyTarget) => void;
  onGoToRegister: () => void;
};

export function LoginScreen({ onNeedsVerification, onGoToRegister }: LoginScreenProps) {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function validateAll(): boolean {
    const emailMessage = validateEmail(email);
    const passwordMessage = validatePassword(password);

    setEmailError(emailMessage);
    setPasswordError(passwordMessage);

    return emailMessage === null && passwordMessage === null;
  }

  async function submit(): Promise<void> {
    setFormError(null);
    if (!validateAll()) return;

    setSubmitting(true);
    try {
      const session = await login({ email: normaliseEmail(email), password });
      await signIn(session.token);
    } catch (caught) {
      const error = asApiError(caught);

      if (error.code === 'EMAIL_NOT_VERIFIED') {
        onNeedsVerification({
          email: normaliseEmail(email),
          otpSent: detailString(error, 'otpSent') === 'true',
          resendAvailableAt: detailString(error, 'resendAvailableAt'),
        });
        return;
      }

      const emailMessage = error.fields.email ?? null;
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
      title="Welcome back"
      subtitle="Log in to pick up where you left off."
      footer={
        <TextLink
          disabled={submitting}
          label="New here? Create an account"
          onPress={onGoToRegister}
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
          autoComplete="current-password"
          editable={!submitting}
          error={passwordError}
          label="Password"
          onBlur={() => setPasswordError(validatePassword(password))}
          onChangeText={setPassword}
          onSubmitEditing={submit}
          returnKeyType="go"
          secureTextEntry={!showPassword}
          textContentType="password"
          trailing={
            <TextLink
              label={showPassword ? 'Hide' : 'Show'}
              onPress={() => setShowPassword(!showPassword)}
            />
          }
          value={password}
        />

        <Button label="Log in" loading={submitting} onPress={submit} />
      </View>
    </AuthLayout>
  );
}
