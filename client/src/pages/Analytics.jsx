import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { analyticsService } from '../services/api';
import { STATUS_HEX } from '../components/StatusBadge';
import { JobStatus } from '../components/Patch';

const COLORS = [STATUS_HEX.valid, STATUS_HEX.invalid, STATUS_HEX.risky, STATUS_HEX['catch-all'], STATUS_HEX.unknown];

export default function Analytics() {
  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => analyticsService.getStats().then(r => r.data.data),
  });

  const { data: chart } = useQuery({
    queryKey: ['chart', 30],
    queryFn: () => analyticsService.getChartData(30).then(r => r.data.data),
  });

  const { data: jobs } = useQuery({
    queryKey: ['bulk-jobs'],
    queryFn: () => analyticsService.getBulkJobs().then(r => r.data.data),
  });

  const daily = chart?.daily || [];
  const topDomains = chart?.topDomains || [];
  const byStatus = stats?.byStatus || {};

  const pieData = [
    { name: 'Valid',     value: byStatus.valid || 0 },
    { name: 'Invalid',   value: byStatus.invalid || 0 },
    { name: 'Risky',     value: byStatus.risky || 0 },
    { name: 'Catch-All', value: byStatus['catch-all'] || 0 },
    { name: 'Unknown',   value: byStatus.unknown || 0 },
  ].filter(d => d.value > 0);

  const ttStyle = {
    contentStyle: { background: '#1A2620', border: '1px solid #23312A', borderRadius: 12, color: '#ECF2EE', fontSize: 12 },
    itemStyle: { color: '#ECF2EE' },
    labelStyle: { color: '#8B9B92' },
    cursor: { fill: 'rgba(255,255,255,0.03)' },
  };

  const axisProps = { fill: '#8B9B92', fontSize: 11 };

  return (
    <div className="page">
      <div className="mb-8">
        <h1 className="page-title">Analytics</h1>
        <p className="page-sub">Verification trends, domain intelligence, and bulk job history</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total verified',    value: stats?.total || 0,           color: '' },
          { label: 'Average score',     value: `${stats?.avgConfidence || 0}%`, color: '' },
          { label: 'Valid rate',        value: stats?.total ? `${Math.round((byStatus.valid / stats.total) * 100)}%` : '—', color: 'text-ok' },
          { label: 'Invalid rate',      value: stats?.total ? `${Math.round((byStatus.invalid / stats.total) * 100)}%` : '—', color: 'text-bad' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-5">
            <div className={`text-[28px] leading-none font-semibold tracking-tight ${color}`}>{value.toLocaleString ? value.toLocaleString() : value}</div>
            <div className="text-muted text-sm mt-2">{label}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        {/* Area Chart */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex justify-between items-center mb-5">
            <h2 className="font-semibold">Daily volume</h2>
            <span className="text-xs text-muted">Last 30 days</span>
          </div>
          {daily.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={daily} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#CFFA39" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#CFFA39" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2FD8CB" stopOpacity={0.14} />
                    <stop offset="95%" stopColor="#2FD8CB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="_id" tick={axisProps} axisLine={false} tickLine={false} />
                <YAxis tick={axisProps} axisLine={false} tickLine={false} />
                <Tooltip {...ttStyle} />
                <Area type="monotone" dataKey="count" name="Total" stroke="#CFFA39" strokeWidth={2} fill="url(#g1)" />
                <Area type="monotone" dataKey="valid" name="Valid"  stroke="#2FD8CB" strokeWidth={2} fill="url(#g2)" strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </div>

        {/* Pie */}
        <div className="card p-6">
          <h2 className="font-semibold mb-5">Result mix</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="45%" innerRadius={45} outerRadius={70}
                  paddingAngle={3} dataKey="value" nameKey="name">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} strokeWidth={0} />)}
                </Pie>
                <Tooltip {...ttStyle} />
                <Legend iconType="circle" iconSize={8} formatter={(v) => (
                  <span style={{ color: '#8B9B92', fontSize: 12 }}>{v}</span>
                )} />
              </PieChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </div>
      </div>

      {/* Top Domains Bar Chart */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="card p-6">
          <h2 className="font-semibold mb-5">Top 10 domains</h2>
          {topDomains.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topDomains.slice(0, 10)} layout="vertical" margin={{ left: 0, right: 20 }}>
                <XAxis type="number" tick={axisProps} axisLine={false} tickLine={false} />
                <YAxis dataKey="_id" type="category" tick={axisProps} axisLine={false} tickLine={false} width={110} />
                <Tooltip {...ttStyle} />
                <Bar dataKey="count" name="Checks" fill="#2FD8CB" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </div>

        {/* Bulk Job History */}
        <div className="card p-6">
          <h2 className="font-semibold mb-5">Bulk uploads</h2>
          {jobs?.length > 0 ? (
            <div className="space-y-2 max-h-[220px] overflow-y-auto">
              {jobs.map(job => (
                <div key={job._id} className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm hover:bg-surface2">
                  <div className="flex-1 min-w-0">
                    <p className="text-ink truncate font-medium">{job.fileName}</p>
                    <p className="text-muted mt-0.5">{job.totalEmails?.toLocaleString()} emails</p>
                  </div>
                  <span className="text-muted shrink-0 text-xs">
                    {new Date(job.createdAt).toLocaleDateString()}
                  </span>
                  <JobStatus job={job} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted text-sm h-40 flex items-center justify-center">
              No bulk jobs yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


function Empty() {
  return (
    <div className="h-40 flex items-center justify-center text-muted text-sm">
      No data yet
    </div>
  );
}
