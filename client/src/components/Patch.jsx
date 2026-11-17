/**
 * Glass patch: a small tinted-glass tile used for every status label
 * (Valid, Invalid, Online, Done…). Replaces the old pills and dots.
 *
 *   <Patch tone="ok" icon="check">Valid</Patch>
 *   tones: ok | bad | warn | catch | unk | aqua
 */
const ICONS = {
  check: <path d="M20 6 9 17l-5-5" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  alert: <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>,
  inbox: <><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z" /></>,
  help: <><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  spin: <path d="M21 12a9 9 0 1 1-6.2-8.6" />,
};

export default function Patch({ tone = 'unk', icon, size = 'md', className = '', children, title }) {
  return (
    <span className={`patch patch-${tone} ${size === 'sm' ? 'patch-sm' : ''} ${className}`} title={title}>
      {icon && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
          className={icon === 'spin' ? 'animate-spin' : ''} aria-hidden="true">
          {ICONS[icon]}
        </svg>
      )}
      {children}
    </span>
  );
}

/** Email result: valid, invalid, risky, catch-all, unknown. */
export const STATUS_PATCH = {
  valid: { label: 'Valid', tone: 'ok', icon: 'check' },
  invalid: { label: 'Invalid', tone: 'bad', icon: 'x' },
  risky: { label: 'Risky', tone: 'warn', icon: 'alert' },
  'catch-all': { label: 'Catch-all', tone: 'catch', icon: 'inbox' },
  unknown: { label: 'Unknown', tone: 'unk', icon: 'help' },
};

/** Bulk job state. */
const JOB_PATCH = {
  completed: { label: 'Done', tone: 'ok', icon: 'check' },
  processing: { label: 'Running', tone: 'aqua', icon: 'spin' },
  queued: { label: 'Queued', tone: 'unk', icon: 'clock' },
  failed: { label: 'Failed', tone: 'bad', icon: 'x' },
};

export function JobStatus({ job }) {
  const p = JOB_PATCH[job.status] || JOB_PATCH.queued;
  return <Patch tone={p.tone} icon={p.icon}>{job.status === 'processing' ? `${job.progress || 0}%` : p.label}</Patch>;
}

/** Online / offline style health. */
export function Health({ ok, on = 'Online', off = 'Offline' }) {
  return <Patch tone={ok ? 'ok' : 'bad'} icon={ok ? 'check' : 'x'}>{ok ? on : off}</Patch>;
}
