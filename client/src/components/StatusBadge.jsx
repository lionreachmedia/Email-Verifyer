const STATUS_CONFIG = {
  valid:      { label: 'Valid',      cls: 'status-valid' },
  invalid:    { label: 'Invalid',    cls: 'status-invalid' },
  risky:      { label: 'Risky',      cls: 'status-risky' },
  'catch-all':{ label: 'Catch-All',  cls: 'status-catch-all' },
  unknown:    { label: 'Unknown',    cls: 'status-unknown' },
};

export default function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
  return (
    <span className={`badge ${cfg.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {cfg.label}
    </span>
  );
}
