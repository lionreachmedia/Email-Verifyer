import { motion } from 'framer-motion';
import Logo from './Logo';

export default function AuthShell({ title, sub, children, footer }) {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-1/4 w-80 h-80 bg-purple/5 rounded-full blur-3xl" />
      </div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm relative">
        <div className="flex items-center gap-3 mb-8"><Logo size="lg" /></div>
        <h1 className="text-2xl font-semibold tracking-tight mb-1">{title}</h1>
        <p className="text-white/40 text-sm mb-8">{sub}</p>
        <div className="card p-6">{children}</div>
        {footer && <div className="text-center text-sm text-white/30 mt-6">{footer}</div>}
      </motion.div>
    </div>
  );
}

export function Spinner({ className = 'w-4 h-4' }) {
  return <div className={`${className} border-2 border-white/20 border-t-white rounded-full animate-spin`} />;
}

export function Field({ label, error, children, right }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <label className="text-xs text-white/40">{label}</label>
        {right}
      </div>
      {children}
      {error && <p className="text-danger text-xs mt-1">{error}</p>}
    </div>
  );
}
