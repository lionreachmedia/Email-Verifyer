import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { analyticsService, accountService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge, { STATUS_HEX } from '../components/StatusBadge';
import Patch, { JobStatus, Health } from '../components/Patch';
import { useProviderCredits, LOW_CREDITS } from '../lib/useProviderCredits';

const MIX = [
  { key: 'valid', label: 'Valid' },
  { key: 'invalid', label: 'Invalid' },
  { key: 'risky', label: 'Risky' },
  { key: 'catch-all', label: 'Catch-all' },
  { key: 'unknown', label: 'Unknown' },
];

// Fill days with no activity so the chart always shows a full 14-day window.
function lastDays(daily, days = 14) {
  const byDay = Object.fromEntries(daily.map((d) => [d._id, d]));
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(Date.now() - (days - 1 - i) * 86400000);
    const key = date.toISOString().slice(0, 10);
    const d = byDay[key] || { count: 0, valid: 0, invalid: 0 };
    return {
      day: date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      valid: d.valid,
      invalid: d.invalid,
      other: Math.max(0, d.count - d.valid - d.invalid),
    };
  });
}

export default function Dashboard() {
  const { user } = useAuth();

  const { data: statsData } = useQuery({
    queryKey: ['stats'],
    queryFn: () => analyticsService.getStats().then((r) => r.data.data),
  });
  const { data: chartData } = useQuery({
    queryKey: ['chart'],
    queryFn: () => analyticsService.getChartData(14).then((r) => r.data.data),
  });
  const { data: jobs } = useQuery({
    queryKey: ['bulk-jobs'],
    queryFn: () => analyticsService.getBulkJobs().then((r) => r.data.data),
  });
  const { data: system } = useQuery({
    queryKey: ['system-status'],
    queryFn: () => accountService.systemStatus().then((r) => r.data.data),
  });

  const { data: pc } = useProviderCredits();
  const reoon = pc?.configured;

  const stats = statsData || { total: 0, avgConfidence: 0, byStatus: { valid: 0, invalid: 0, risky: 0, 'catch-all': 0, unknown: 0 } };
  const total = stats.total || 0;
  const valid = stats.byStatus.valid || 0;
  const rate = total ? Math.round((valid / total) * 100) : null;
  const days = lastDays(chartData?.daily || []);
  const hasActivity = days.some((d) => d.valid + d.invalid + d.other > 0);
  const topDomains = (chartData?.topDomains || []).slice(0, 6);
  const recentJobs = (jobs || []).slice(0, 5);
  const firstName = user?.name?.split(' ')[0];

  return (
    <div className="page">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">{firstName ? `Good to see you, ${firstName}. Here's how your lists are holding up.` : "Here's how your lists are holding up."}</p>
        </div>
        <div className="flex gap-3">
          <Link to="/bulk" className="btn-ghost">Upload a list</Link>
          <Link to="/verify" className="btn-primary">Verify an email</Link>
        </div>
      </div>

      {/* List health */}
      <section className="panel-dark mesh p-7 lg:p-9 mb-6 shadow-lift" aria-labelledby="health-title">
        <div className="grid lg:grid-cols-[minmax(220px,280px)_1fr] gap-8 lg:gap-12 items-end">
          <div>
            <h2 id="health-title" className="text-sm text-white/60 font-medium">Deliverable rate</h2>
            {total ? (
              <>
                <p className="text-[64px] leading-none font-semibold tracking-tight text-lime mt-3">{rate}%</p>
                <p className="text-sm text-white/70 mt-3">{valid.toLocaleString()} of {total.toLocaleString()} addresses confirmed deliverable</p>
              </>
            ) : (
              <>
                <p className="text-[64px] leading-none font-semibold tracking-tight text-white/25 mt-3">—</p>
                <p className="text-sm text-white/70 mt-3">Check an address or upload a list and your rate shows up here.</p>
              </>
            )}
          </div>

          <div>
            <div className="flex h-4 rounded-full overflow-hidden bg-white/[0.08] gap-[2px]" role="img"
              aria-label={total ? MIX.map((m) => `${m.label} ${stats.byStatus[m.key] || 0}`).join(', ') : 'No results yet'}>
              {total > 0 && MIX.map((m) => {
                const n = stats.byStatus[m.key] || 0;
                return n ? <div key={m.key} style={{ width: `${(n / total) * 100}%`, background: STATUS_HEX[m.key] }} title={`${m.label}: ${n}`} /> : null;
              })}
            </div>
            <dl className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-5">
              {MIX.map((m) => {
                const n = stats.byStatus[m.key] || 0;
                return (
                  <div key={m.key}>
                    <dt><StatusBadge status={m.key} /></dt>
                    <dd className="mt-3 text-2xl font-semibold text-white">{n.toLocaleString()}</dd>
                    <dd className="text-xs text-white/50">{total ? `${Math.round((n / total) * 100)}%` : '0%'}</dd>
                  </div>
                );
              })}
            </dl>
          </div>
        </div>
      </section>

      {/* Activity + credits */}
      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <section className="card p-6 lg:col-span-2 flex flex-col">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-semibold">Activity</h2>
            <span className="text-xs text-muted">Last 14 days</span>
          </div>
          {hasActivity ? (
            <>
              <div className="flex-1 min-h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={days} margin={{ top: 4, right: 0, bottom: 0, left: -24 }} barCategoryGap="28%">
                  <CartesianGrid vertical={false} stroke="#23312A" />
                  <XAxis dataKey="day" tick={{ fill: '#8B9B92', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} tick={{ fill: '#8B9B92', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} contentStyle={{ background: '#1A2620', border: '1px solid #23312A', borderRadius: 12, fontSize: 12, color: '#ECF2EE' }} itemStyle={{ color: '#ECF2EE' }} labelStyle={{ color: '#8B9B92' }} />
                  <Bar dataKey="valid" name="Valid" stackId="a" fill={STATUS_HEX.valid} />
                  <Bar dataKey="invalid" name="Invalid" stackId="a" fill={STATUS_HEX.invalid} />
                  <Bar dataKey="other" name="Other" stackId="a" fill="#3B4C43" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <Patch tone="ok" icon="check" size="sm">Valid</Patch>
                <Patch tone="bad" icon="x" size="sm">Invalid</Patch>
                <Patch tone="unk" size="sm">Risky, catch-all and unknown</Patch>
              </div>
            </>
          ) : (
            <Empty text="No checks in the last 14 days." />
          )}
        </section>

        <section className="card p-6 flex flex-col">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">{reoon ? 'Reoon credits' : 'Credits'}</h2>
            {reoon && pc.ok && (pc.total < LOW_CREDITS
              ? <Patch tone="warn" icon="alert" size="sm">Running low</Patch>
              : <Patch tone="aqua" size="sm">Live</Patch>)}
          </div>
          {reoon ? (
            pc.ok ? (
              <>
                <p className="text-[40px] leading-none font-semibold tracking-tight mt-4">{pc.total.toLocaleString()}</p>
                <p className="text-sm text-muted mt-2">Left on your Reoon account. Each mailbox check uses one.</p>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="rounded-xl bg-surface2 px-3 py-2.5">
                    <p className="text-xs text-muted">Instant</p>
                    <p className="text-lg font-semibold">{(pc.instant ?? 0).toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl bg-surface2 px-3 py-2.5">
                    <p className="text-xs text-muted">Daily</p>
                    <p className="text-lg font-semibold">{(pc.daily ?? 0).toLocaleString()}</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-bad mt-4">Couldn&apos;t load your Reoon balance: {pc.error}</p>
            )
          ) : (
            <>
              <p className="text-[40px] leading-none font-semibold tracking-tight mt-4">{(user?.credits || 0).toLocaleString()}</p>
              <p className="text-sm text-muted mt-2">1 credit per address. Results we can&apos;t confirm are refunded.</p>
            </>
          )}
          <div className="mt-5 pt-5 border-t border-line space-y-3 text-sm">
            {reoon && system?.userCreditsEnabled !== false && <Row label="Your MailGuard credits" value={(user?.credits || 0).toLocaleString()} />}
            <Row label="Addresses verified" value={(user?.totalVerified || 0).toLocaleString()} />
            <Row label="Average score" value={total ? `${stats.avgConfidence}%` : '—'} />
          </div>
          {system && (
            <div className="mt-auto pt-5 space-y-2 text-sm">
              <HealthRow label="Bulk worker"><Health ok={system.workerOnline} /></HealthRow>
              <HealthRow label="Mailbox checker"><Health ok={system.mailboxChecksEnabled} on="Ready" off="Not set up" /></HealthRow>
            </div>
          )}
        </section>
      </div>

      {/* Domains + uploads */}
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="card p-6">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-semibold">Top domains</h2>
            <Link to="/analytics" className="link text-xs">Analytics</Link>
          </div>
          {topDomains.length ? (
            <ul className="space-y-3.5">
              {topDomains.map((d) => (
                <li key={d._id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] items-center gap-4 text-sm">
                  <span className="truncate">{d._id}</span>
                  <span className="h-1.5 bg-surface2 rounded-full overflow-hidden">
                    <span className="block h-full bg-aqua rounded-full" style={{ width: `${Math.max(4, Math.round((d.count / topDomains[0].count) * 100))}%` }} />
                  </span>
                  <span className="text-muted w-12 text-right">{d.count.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="Domains appear here once you verify a few addresses." />
          )}
        </section>

        <section className="card p-6">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-semibold">Recent uploads</h2>
            <Link to="/bulk" className="link text-xs">Bulk Verify</Link>
          </div>
          {recentJobs.length ? (
            <ul className="divide-y divide-line -my-3">
              {recentJobs.map((j) => {
                const pct = j.totalEmails ? Math.round(((j.results?.valid || 0) / j.totalEmails) * 100) : 0;
                return (
                  <li key={j.jobId} className="flex items-center gap-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{j.fileName}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {j.totalEmails.toLocaleString()} addresses{j.status === 'completed' ? `, ${pct}% valid` : ''}
                      </p>
                    </div>
                    <JobStatus job={j} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty text="No lists uploaded yet." action={<Link to="/bulk" className="link text-sm">Upload your first list</Link>} />
          )}
        </section>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}


function HealthRow({ label, children }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      {children}
    </div>
  );
}

function Empty({ text, action }) {
  return (
    <div className="h-40 flex flex-col items-center justify-center gap-3 text-sm text-muted text-center">
      <p>{text}</p>
      {action}
    </div>
  );
}
