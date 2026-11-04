import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { authService, errorMessage } from '../services/api';
import AuthShell, { Field, Spinner } from '../components/AuthShell';

export default function ForgotPassword() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();
  const [sentTo, setSentTo] = useState(null);

  const onSubmit = async ({ email }) => {
    try {
      await authService.forgotPassword({ email });
      setSentTo(email);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      sub="We'll email you a link to choose a new one"
      footer={<Link to="/login" className="text-accent">Back to sign in</Link>}
    >
      {sentTo ? (
        <p className="text-sm text-white/60 leading-relaxed">
          If <span className="text-white">{sentTo}</span> has an account, a reset link is on its way. It expires in 30 minutes, so check spam if you don't see it.
        </p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Email" error={errors.email?.message}>
            <input {...register('email', { required: 'Enter your email' })} type="email" autoComplete="email" className="input" placeholder="you@company.com" />
          </Field>
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full justify-center py-3">
            {isSubmitting ? <Spinner /> : 'Send reset link'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
