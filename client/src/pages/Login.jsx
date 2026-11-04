import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { authService, errorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AuthShell, { Field, Spinner } from '../components/AuthShell';
import OtpForm from '../components/OtpForm';

export default function Login() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [pendingEmail, setPendingEmail] = useState(null);

  const onSubmit = async (data) => {
    try {
      const res = await authService.login(data);
      login(res.data.token, res.data.user);
      navigate('/');
    } catch (err) {
      if (err.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
        setPendingEmail(err.response.data.email);
        authService.resendOtp(err.response.data.email).catch(() => {});
        toast('We sent you a new verification code', { icon: '📧' });
      } else {
        toast.error(errorMessage(err, 'Sign-in failed'));
      }
    }
  };

  if (pendingEmail) {
    return (
      <AuthShell title="Verify your email" sub="Enter the 6-digit code from your inbox">
        <OtpForm
          email={pendingEmail}
          onBack={() => setPendingEmail(null)}
          onVerified={(d) => { login(d.token, d.user); navigate('/'); }}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Welcome back"
      sub={params.get('expired') ? 'Your session expired. Sign in again.' : 'Sign in to your MailGuard account'}
      footer={<>No account yet? <Link to="/register" className="text-accent">Create one</Link></>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Email" error={errors.email?.message}>
          <input {...register('email', { required: 'Enter your email' })} type="email" autoComplete="email" className="input" placeholder="you@company.com" />
        </Field>
        <Field label="Password" error={errors.password?.message} right={<Link to="/forgot-password" className="text-xs text-accent">Forgot password?</Link>}>
          <input {...register('password', { required: 'Enter your password' })} type="password" autoComplete="current-password" className="input" placeholder="••••••••" />
        </Field>
        <button type="submit" disabled={isSubmitting} className="btn-primary w-full justify-center py-3">
          {isSubmitting ? <Spinner /> : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  );
}
