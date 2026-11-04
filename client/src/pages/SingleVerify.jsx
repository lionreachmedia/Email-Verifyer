import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { verifyService, errorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import { reasonLabel, PROVIDER_NAMES } from '../lib/reasons';

const MAILBOX_TEXT = {
  deliverable: ['Exists', true], undeliverable: ['Does not exist', false], full: ['Full', false],
  unknown: ['Not confirmed', null], skipped: ['Not checked', null],
};

const STATUS_HELP = {
  valid: 'Safe to send. The mailbox was confirmed.',
  invalid: 'Do not send. This address will bounce.',
  risky: 'Exists or might, but sending carries risk (full, disposable, spam trap…).',
  'catch-all': 'The domain accepts every address, so this exact mailbox can\'t be confirmed. Send with care.',
  unknown: 'We could not get a definite answer. Nothing was charged. Try again later or add another checker.',
};

export default function SingleVerify() {
  const { refreshUser } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const verify = async (value = email) => {
    if (!value.trim()) return toast.error('Enter an email address');
    setLoading(true);
    setResult(null);
    try {
      const res = await verifyService.single(value.trim());
      setResult(res.data.data);
      refreshUser();
    } catch (err) {
      toast.error(errorMessage(err, 'Verification failed'));
    } finally {
      setLoading(false);
    }
  };

  const conf = result?.confidence;
  const confColor = conf == null ? '#6b7280' : conf >= 80 ? '#2ecc87' : conf >= 40 ? '#f5a623' : '#f05252';
  const [mailboxText, mailboxOk] = MAILBOX_TEXT[result?.mailbox] || MAILBOX_TEXT.skipped;

  const checks = result ? [
    ['Valid format', result.syntaxValid, true],
    ['Domain exists', result.domainExists, true],
    ['Mail server (MX)', result.mxFound, true],
    ['Mailbox', mailboxOk, true, mailboxText],
    ['Catch-all domain', result.catchAll, false],
    ['Disposable', result.disposable, false],
    ['Role address (info@, sales@…)', result.roleBased, false],
    ['Free provider (Gmail, Yahoo…)', result.freeProvider, null],
  ] : [];

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Verify one email</h1>
        <p className="text-white/40 text-sm mt-1">Checks format, domain, mail server and the mailbox itself. Costs 1 credit, and nothing if we can't get an answer.</p>
      </div>

      <div className="card p-6 mb-6">
        <form className="flex gap-3" onSubmit={(e) => { e.preventDefault(); verify(); }}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="input flex-1" placeholder="name@company.com" disabled={loading} autoFocus />
          <button type="submit" disabled={loading} className="btn-primary px-6 shrink-0">
            {loading ? <><div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> Checking…</> : 'Verify'}
          </button>
        </form>
        {loading && <p className="text-xs text-white/30 mt-3">Checking the mailbox can take up to 30 seconds.</p>}
      </div>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card overflow-hidden mb-6">
            <div className="flex flex-wrap items-center gap-4 px-6 py-5 border-b border-white/5">
              <StatusBadge status={result.status} />
              <span className="font-mono text-sm text-white/70 break-all">{result.email}</span>
              <div className="ml-auto text-right">
                <div className="text-2xl font-semibold" style={{ color: confColor }}>{conf == null ? '—' : `${conf}%`}</div>
                <div className="text-[11px] text-white/30">deliverability score</div>
              </div>
            </div>

            <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02]">
              <p className="text-sm font-medium">{reasonLabel(result.reason)}</p>
              <p className="text-sm text-white/50 mt-1">{result.details || STATUS_HELP[result.status]}</p>
              {result.suggestion && result.suggestion !== result.email && (
                <button onClick={() => { setEmail(result.suggestion); verify(result.suggestion); }} className="text-sm text-accent mt-2">
                  Did you mean {result.suggestion}? Check it
                </button>
              )}
            </div>

            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/5">
              <div className="p-6 space-y-3">
                {checks.map(([label, value, goodWhenTrue, text]) => {
                  const known = value !== null && value !== undefined;
                  const good = goodWhenTrue === null ? null : known ? (goodWhenTrue ? !!value : !value) : null;
                  const color = good === null ? 'text-white/40' : good ? 'text-success' : 'text-danger';
                  return (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span className="text-white/50">{label}</span>
                      <span className={`text-xs font-medium ${color}`}>{text || (known ? (value ? 'Yes' : 'No') : 'Unknown')}</span>
                    </div>
                  );
                })}
              </div>
              <div className="p-6 space-y-3 text-sm">
                <Detail label="Answered by" value={PROVIDER_NAMES[result.provider] || result.provider} />
                <Detail label="Mail server" value={result.mxRecord || '—'} mono />
                <Detail label="Checker response" value={result.providerResponse || '—'} mono />
                <Detail label="Time" value={result.cached ? 'Recent result (cached)' : `${(result.durationMs / 1000).toFixed(1)}s`} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="card p-6">
        <h2 className="font-semibold text-sm mb-4">What each result means</h2>
        <dl className="grid md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          {Object.entries(STATUS_HELP).map(([s, text]) => (
            <div key={s} className="flex gap-3 items-start"><StatusBadge status={s} /><dd className="text-white/50">{text}</dd></div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function Detail({ label, value, mono }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-white/30 text-xs shrink-0">{label}</span>
      <span className={`text-right text-xs break-all text-white/80 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}
