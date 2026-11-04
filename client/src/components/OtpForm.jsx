import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { authService, errorMessage } from '../services/api';
import { Spinner } from './AuthShell';

/** 6-digit code entry with a "Resend code" button (60 s cooldown). */
export default function OtpForm({ email, onVerified, onBack, startCooldown = 60 }) {
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(startCooldown);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const verify = async (e) => {
    e?.preventDefault();
    if (!/^\d{6}$/.test(otp)) return toast.error('Enter the 6-digit code');
    setBusy(true);
    try {
      const { data } = await authService.verifyOtp({ email, otp });
      onVerified(data);
    } catch (err) {
      toast.error(errorMessage(err, 'Invalid code'));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      await authService.resendOtp(email);
      toast.success('New code sent');
      setCooldown(60);
      setOtp('');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not resend the code'));
    }
  };

  return (
    <form onSubmit={verify} className="space-y-4">
      <p className="text-xs text-white/40">Code sent to <span className="text-white/70">{email}</span></p>
      <input
        className="input text-center text-2xl tracking-[0.8rem]"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="000000"
        value={otp}
        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
        autoFocus
      />
      <button type="submit" disabled={busy} className="btn-primary w-full justify-center">
        {busy ? <Spinner /> : 'Verify email'}
      </button>
      <div className="flex justify-between text-xs">
        <button type="button" onClick={onBack} className="text-white/30 hover:text-white/60">Back</button>
        <button type="button" onClick={resend} disabled={cooldown > 0} className="text-accent disabled:text-white/20">
          {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        </button>
      </div>
    </form>
  );
}
