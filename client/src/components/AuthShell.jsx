import Logo from './Logo';

export default function AuthShell({ title, sub, children, footer }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(380px,44%)_1fr] bg-canvas">
      {/* Brand panel */}
      <aside className="hidden lg:flex flex-col justify-between mesh border-r border-line text-white p-12">
        <Logo size="lg" />
        <div className="max-w-sm">
          <p className="text-[40px] leading-[1.1] font-semibold tracking-tight">Bounces are optional.</p>
          <p className="text-white/65 mt-5 leading-relaxed">
            Check every address before it reaches your sender reputation. Format, domain, mail server and the mailbox itself, in seconds.
          </p>
        </div>
        <p className="text-xs text-white/40">No guesswork: if we can't prove an address is bad, we say so.</p>
      </aside>

      {/* Form */}
      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[400px]">
          <div className="lg:hidden mb-10"><Logo size="lg" tone="light" /></div>
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight">{title}</h1>
          <p className="text-muted text-sm mt-2 mb-8">{sub}</p>
          <div className="card p-6 sm:p-7">{children}</div>
          {footer && <div className="text-center text-sm text-muted mt-6">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

export function Spinner({ className = 'w-4 h-4' }) {
  return <span className={`${className} inline-block border-2 border-current border-t-transparent rounded-full animate-spin`} aria-label="Loading" />;
}

export function Field({ label, error, children, right }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm font-medium text-ink">{label}</label>
        {right}
      </div>
      {children}
      {error && <p className="text-bad text-xs mt-1.5">{error}</p>}
    </div>
  );
}
