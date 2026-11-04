import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { analyticsService } from '../services/api';

const COLORS = ['#2ecc87', '#f05252', '#f5a623', '#9b6dff', '#555a6a'];

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
    contentStyle: { background: '#181c22', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, color: '#e8eaf0', fontSize: 11 },
    itemStyle: { color: '#8b90a0' },
    cursor: { fill: 'rgba(255,255,255,0.03)' },
  };

  const axisProps = { fill: '#555a6a', fontSize: 10 };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-white/40 text-sm mt-1">Verification trends, domain intelligence, and bulk job history</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Verified',    value: stats?.total || 0,           color: '' },
          { label: 'Avg. Confidence',   value: `${stats?.avgConfidence || 0}%`, color: 'text-accent' },
          { label: 'Valid Rate',        value: stats?.total ? `${Math.round((byStatus.valid / stats.total) * 100)}%` : '—', color: 'text-success' },
          { label: 'Invalid Rate',      value: stats?.total ? `${Math.round((byStatus.invalid / stats.total) * 100)}%` : '—', color: 'text-danger' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-5">
            <div className={`text-2xl font-semibold tracking-tight ${color}`}>{value.toLocaleString ? value.toLocaleString() : value}</div>
            <div className="text-white/30 text-xs mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Area Chart */}
        <div className="col-span-2 card p-6">
          <div className="flex justify-between items-center mb-5">
            <h2 className="font-semibold text-sm">Daily Volume — Last 30 Days</h2>
          </div>
          {daily.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={daily} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f8ef7" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#4f8ef7" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2ecc87" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#2ecc87" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="_id" tick={axisProps} axisLine={false} tickLine={false} />
                <YAxis tick={axisProps} axisLine={false} tickLine={false} />
                <Tooltip {...ttStyle} />
                <Area type="monotone" dataKey="count" name="Total" stroke="#4f8ef7" strokeWidth={2} fill="url(#g1)" />
                <Area type="monotone" dataKey="valid" name="Valid"  stroke="#2ecc87" strokeWidth={1.5} fill="url(#g2)" strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </div>

        {/* Pie */}
        <div className="card p-6">
          <h2 className="font-semibold text-sm mb-5">Status Mix</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="45%" innerRadius={45} outerRadius={70}
                  paddingAngle={3} dataKey="value" nameKey="name">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} strokeWidth={0} />)}
                </Pie>
                <Tooltip {...ttStyle} />
                <Legend iconType="circle" iconSize={8} formatter={(v) => (
                  <span style={{ color: '#8b90a0', fontSize: 11 }}>{v}</span>
                )} />
              </PieChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </div>
      </div>

      {/* Top Domains Bar Chart */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="card p-6">
          <h2 className="font-semibold text-sm mb-5">Top 10 Verified Domains</h2>
          {topDomains.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topDomains.slice(0, 10)} layout="vertical" margin={{ left: 0, right: 20 }}>
                <XAxis type="number" tick={axisProps} axisLine={false} tickLine={false} />
                <YAxis dataKey="_id" type="category" tick={{ ...axisProps, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} width={110} />
                <Tooltip {...ttStyle} />
                <Bar dataKey="count" fill="#4f8ef7" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </div>

        {/* Bulk Job History */}
        <div className="card p-6">
          <h2 className="font-semibold text-sm mb-5">Bulk Job History</h2>
          {jobs?.length > 0 ? (
            <div className="space-y-2 max-h-[220px] overflow-y-auto">
              {jobs.map(job => (
                <div key={job._id} className="flex items-center gap-3 p-3 bg-bg-3 rounded-xl text-xs">
                  <StatusDot status={job.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white/70 truncate font-medium">{job.fileName}</p>
                    <p className="text-white/30 mt-0.5">{job.totalEmails?.toLocaleString()} emails</p>
                  </div>
                  <span className="text-white/30 shrink-0">
                    {new Date(job.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-white/20 text-sm h-40 flex items-center justify-center">
              No bulk jobs yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusDot({ status }) {
  const colors = { completed: 'bg-success', processing: 'bg-accent animate-pulse', failed: 'bg-danger', queued: 'bg-warning' };
  return <div className={`w-2 h-2 rounded-full ${colors[status] || 'bg-white/20'}`} />;
}

function Empty() {
  return (
    <div className="h-40 flex items-center justify-center text-white/20 text-sm">
      No data yet
    </div>
  );
}
