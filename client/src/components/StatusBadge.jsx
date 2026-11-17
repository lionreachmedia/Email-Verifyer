import Patch, { STATUS_PATCH } from './Patch';

// Solid colors for charts and the mix bar (same hues as the patches).
export const STATUS_HEX = {
  valid: '#5CD08A', invalid: '#F47C6E', risky: '#F2B65A', 'catch-all': '#A594FF', unknown: '#5E6E66',
};

export default function StatusBadge({ status, size }) {
  const p = STATUS_PATCH[status] || STATUS_PATCH.unknown;
  return <Patch tone={p.tone} icon={p.icon} size={size}>{p.label}</Patch>;
}
