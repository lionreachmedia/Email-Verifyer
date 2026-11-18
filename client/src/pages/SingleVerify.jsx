import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { verifyService, errorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import Patch from '../components/Patch';
import { useUserCreditsEnabled } from '../lib/useSystemStatus';
import { useRefreshProviderCredits } from '../lib/useProviderCredits';
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
  const refreshProviderCredits = useRefreshProviderCredits();
  const creditsOn = useUserCreditsEnabled();
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
      refreshProviderCredits();
    } catch (err) {
      toast.error(errorMessage(err, 'Verification failed'));
    } finally {
      setLoading(false);
    }
  };

  const conf = result?.confidence;
  const confColor = conf == null ? '#8B9B92' : conf >= 80 ? '#5CD08A' : conf >= 40 ? '#F2B65A' : '#F47C6E';
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
    <div className="page">
      <div className="mb-8">
        <h1 className="page-title">Verify one email</h1>
        <p className="page-sub">Checks format, domain, mail server and the mailbox itself.{creditsOn && ' Costs 1 credit, and nothing if we can\'t get an answer.'}</p>
      </div>

      <div className="card p-6 mb-6">
        <form className="flex flex-col sm:flex-row gap-3" onSubmit={(e) => { e.preventDefault(); verify(); }}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="input flex-1" placeholder="name@company.com" disabled={loading} autoFocus />
          <button type="submit" disabled={loading} className="btn-primary px-6 shrink-0">
            {loading ? <><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" /> Checking…</> : 'Verify'}
          </button>
        </form>
        {loading && <p className="text-xs text-muted mt-3">Checking the mailbox can take up to 30 seconds.</p>}
      </div>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card overflow-hidden mb-6">
            <div className="flex flex-wrap items-center gap-4 px-6 py-5 border-b border-line">
              <StatusBadge status={result.status} />
              <span className="text-base font-medium text-ink break-all">{result.email}</span>
              <div className="ml-auto text-right">
                <div className="text-[28px] leading-none font-semibold" style={{ color: confColor }}>{conf == null ? '—' : `${conf}%`}</div>
                <div className="text-xs text-muted mt-1">
                  {result.scoreSource && result.scoreSource !== 'mailguard'
                    ? `Score from ${PROVIDER_NAMES[result.scoreSource] || result.scoreSource}`
                    : 'Deliverability score'}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-b border-line bg-surface2/50">
              <p className="text-sm font-medium">{reasonLabel(result.reason)}</p>
              <p className="text-sm text-muted mt-1">{result.details || STATUS_HELP[result.status]}</p>
              {result.suggestion && result.suggestion !== result.email && (
                <button onClick={() => { setEmail(result.suggestion); verify(result.suggestion); }} className="text-sm link mt-2">
                  Did you mean {result.suggestion}? Check it
                </button>
              )}
            </div>

            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-line">
              <div className="p-6 space-y-2.5">
                {checks.map(([label, value, goodWhenTrue, text]) => {
                  const known = value !== null && value !== undefined;
                  const good = goodWhenTrue === null ? null : known ? (goodWhenTrue ? !!value : !value) : null;
                  const tone = good === null ? 'unk' : good ? 'ok' : 'bad';
                  return (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span className="text-muted">{label}</span>
                      <Patch tone={tone} size="sm">{text || (known ? (value ? 'Yes' : 'No') : 'Unknown')}</Patch>
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
        <h2 className="font-semibold mb-4">What each result means</h2>
        <dl className="grid md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          {Object.entries(STATUS_HELP).map(([s, text]) => (
            <div key={s} className="flex gap-3 items-start"><StatusBadge status={s} /><dd className="text-muted">{text}</dd></div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function Detail({ label, value, mono }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted text-xs shrink-0">{label}</span>
      <span className={`text-right text-xs break-all ${mono ? 'text-muted' : 'text-ink font-medium'}`}>{value}</span>
    </div>
  );
}
