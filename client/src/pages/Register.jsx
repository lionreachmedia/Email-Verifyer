import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { authService, errorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AuthShell, { Field, Spinner } from '../components/AuthShell';
import OtpForm from '../components/OtpForm';

export default function Register() {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState(null); // { email, emailSent }

  const onSubmit = async ({ name, email, password }) => {
    try {
      const { data } = await authService.register({ name, email, password });
      setPending({ email: data.email, emailSent: data.emailSent });
      if (data.emailSent) toast.success(data.message, { duration: 6000 });
      else toast.error(data.message, { duration: 6000 });
    } catch (err) {
      toast.error(errorMessage(err, 'Could not create the account'));
    }
  };

  if (pending) {
    return (
      <AuthShell title="Verify your email" sub="Enter the 6-digit code from your inbox">
        <OtpForm
          email={pending.email}
          startCooldown={pending.emailSent ? 60 : 0}
          onBack={() => setPending(null)}
          onVerified={(d) => { login(d.token, d.user); toast.success('Welcome to MailGuard'); navigate('/'); }}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      sub="Free credits included. No card needed."
      footer={<>Already have an account? <Link to="/login" className="text-accent">Sign in</Link></>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Full name" error={errors.name?.message}>
          <input {...register('name', { required: 'Enter your name' })} autoComplete="name" className="input" placeholder="Jane Doe" />
        </Field>
        <Field label="Work email" error={errors.email?.message}>
          <input {...register('email', { required: 'Enter your email', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email' } })} type="email" autoComplete="email" className="input" placeholder="you@company.com" />
        </Field>
        <Field label="Password" error={errors.password?.message}>
          <input {...register('password', { required: 'Choose a password', minLength: { value: 8, message: 'At least 8 characters' } })} type="password" autoComplete="new-password" className="input" placeholder="At least 8 characters" />
        </Field>
        <Field label="Confirm password" error={errors.confirm?.message}>
          <input {...register('confirm', { validate: (v) => v === watch('password') || 'Passwords do not match' })} type="password" autoComplete="new-password" className="input" placeholder="Repeat password" />
        </Field>
        <button type="submit" disabled={isSubmitting} className="btn-primary w-full justify-center py-3">
          {isSubmitting ? <Spinner /> : 'Create account'}
        </button>
      </form>
    </AuthShell>
  );
}
