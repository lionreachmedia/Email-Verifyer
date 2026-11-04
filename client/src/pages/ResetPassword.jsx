import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { authService, errorMessage, tokenStore } from '../services/api';
import AuthShell, { Field, Spinner } from '../components/AuthShell';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm();

  const onSubmit = async ({ password }) => {
    try {
      const { data } = await authService.resetPassword({ token, password });
      tokenStore.clear();
      toast.success(data.message);
      navigate('/login');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (!/^[a-f0-9]{64}$/.test(token)) {
    return (
      <AuthShell title="Link not valid" sub="This reset link is incomplete or broken" footer={<Link to="/forgot-password" className="text-accent">Request a new link</Link>}>
        <p className="text-sm text-white/60">Open the link from your most recent reset email, or request a new one.</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" sub="You'll be signed out on all devices">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="New password" error={errors.password?.message}>
          <input {...register('password', { required: 'Choose a password', minLength: { value: 8, message: 'At least 8 characters' } })} type="password" autoComplete="new-password" className="input" autoFocus />
        </Field>
        <Field label="Confirm password" error={errors.confirm?.message}>
          <input {...register('confirm', { validate: (v) => v === watch('password') || 'Passwords do not match' })} type="password" autoComplete="new-password" className="input" />
        </Field>
        <button type="submit" disabled={isSubmitting} className="btn-primary w-full justify-center py-3">
          {isSubmitting ? <Spinner /> : 'Update password'}
        </button>
      </form>
    </AuthShell>
  );
}
