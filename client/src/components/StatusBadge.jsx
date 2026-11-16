const STATUS_CONFIG = {
  valid: { label: 'Valid', cls: 'status-valid' },
  invalid: { label: 'Invalid', cls: 'status-invalid' },
  risky: { label: 'Risky', cls: 'status-risky' },
  'catch-all': { label: 'Catch-all', cls: 'status-catch-all' },
  unknown: { label: 'Unknown', cls: 'status-unknown' },
};

export const STATUS_HEX = {
  valid: '#5CD08A', invalid: '#F47C6E', risky: '#F2B65A', 'catch-all': '#A594FF', unknown: '#5E6E66',
};

export default function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
  return (
    <span className={`badge ${cfg.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
      {cfg.label}
    </span>
  );
}
