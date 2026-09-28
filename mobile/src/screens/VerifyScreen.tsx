import { useState } from 'react';
import { View } from 'react-native';
import { resendOtp, verifyOtp } from '../api/auth';
import { asApiError, detailNumber, type ApiError } from '../api/client';
import { useSession } from '../auth/SessionProvider';
import { AuthLayout } from '../components/AuthLayout';
import { Banner, type BannerTone } from '../components/Banner';
import { Button } from '../components/Button';
import { OtpInput, OTP_LENGTH } from '../components/OtpInput';
import { TextLink } from '../components/TextLink';
import { useSecondsUntil } from '../hooks/useSecondsUntil';

export type VerifyTarget = {
  email: string;
  otpSent: boolean;
  resendAvailableAt: string | null;
};

type VerifyScreenProps = {
  target: VerifyTarget;
  onGoToLogin: () => void;
};

type Notice = { tone: BannerTone; message: string };

const NEEDS_NEW_CODE = ['OTP_EXPIRED', 'OTP_LOCKED', 'OTP_NOT_FOUND'];

function resendDeadline(iso: string | null): number {
  if (iso === null) return 0;
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function invalidCodeMessage(message: string, attemptsLeft: number | null): string {
  if (attemptsLeft === null) return message;
  if (attemptsLeft === 0) return `${message} You have no attempts left, so request a new code.`;
  return `${message} ${attemptsLeft} ${attemptsLeft === 1 ? 'attempt' : 'attempts'} left.`;
}

export function VerifyScreen({ target, onGoToLogin }: VerifyScreenProps) {
  const { signIn } = useSession();
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState<Notice | null>({
    tone: 'info',
    message: target.otpSent
      ? `We sent a ${OTP_LENGTH}-digit code to ${target.email}.`
      : `A code is already on its way to ${target.email}. Check your inbox, or resend below.`,
  });
  const [invalidCode, setInvalidCode] = useState(false);
  const [resendAt, setResendAt] = useState(() => resendDeadline(target.resendAvailableAt));
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const secondsLeft = useSecondsUntil(resendAt);
  const busy = verifying || resending;

  function showFailure(error: ApiError): void {
    if (error.code === 'OTP_INVALID') {
      const attemptsLeft = detailNumber(error, 'attemptsLeft');
      setCode('');
      setInvalidCode(true);
      setNotice({ tone: 'error', message: invalidCodeMessage(error.message, attemptsLeft) });
      if (attemptsLeft === 0) setResendAt(0);
      return;
    }

    // These are only recoverable with a fresh code, so drop the cooldown and open Resend now.
    if (NEEDS_NEW_CODE.includes(error.code)) {
      setCode('');
      setResendAt(0);
      setNotice({ tone: 'error', message: error.message });
      return;
    }

    setNotice({ tone: 'error', message: error.fields.code ?? error.message });
  }

  async function verify(): Promise<void> {
    setNotice(null);
    setInvalidCode(false);
    setVerifying(true);
    try {
      const session = await verifyOtp({ email: target.email, code });
      await signIn(session.token);
    } catch (caught) {
      showFailure(asApiError(caught));
    } finally {
      setVerifying(false);
    }
  }

  async function resend(): Promise<void> {
    setNotice(null);
    setInvalidCode(false);
    setResending(true);
    try {
      const issued = await resendOtp({ email: target.email });
      setCode('');
      setResendAt(resendDeadline(issued.resendAvailableAt));
      setNotice({ tone: 'info', message: `We sent a new code to ${target.email}.` });
    } catch (caught) {
      const error = asApiError(caught);
      const retryAfter = detailNumber(error, 'retryAfterSeconds');
      if (error.code === 'OTP_COOLDOWN' && retryAfter !== null) {
        setResendAt(Date.now() + retryAfter * 1000);
      }
      setNotice({ tone: 'error', message: error.message });
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthLayout
      title="Check your email"
      subtitle={`Enter the ${OTP_LENGTH}-digit code we sent to ${target.email}.`}
      footer={<TextLink disabled={busy} label="Back to log in" onPress={onGoToLogin} />}
    >
      <View className="gap-4">
        {notice === null ? null : <Banner message={notice.message} tone={notice.tone} />}

        <OtpInput
          editable={!busy}
          invalid={invalidCode}
          onChangeText={(next) => {
            setCode(next);
            setInvalidCode(false);
          }}
          value={code}
        />

        <Button
          disabled={busy || code.length < OTP_LENGTH}
          label="Verify email"
          loading={verifying}
          onPress={verify}
        />

        <Button
          disabled={busy || secondsLeft > 0}
          label={secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : 'Resend code'}
          loading={resending}
          onPress={resend}
          variant="secondary"
        />
      </View>
    </AuthLayout>
  );
}
