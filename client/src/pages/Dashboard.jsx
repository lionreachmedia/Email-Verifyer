import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { analyticsService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';

const COLORS = ['#2ecc87', '#f05252', '#f5a623', '#9b6dff', '#555a6a'];

const statCards = [
  { key: 'total',      label: 'Total Verified',  color: 'text-white',     bg: 'bg-accent/10',   icon: '📊' },
  { key: 'valid',      label: 'Valid',            color: 'text-success',   bg: 'bg-success/10',  icon: '✅' },
  { key: 'invalid',    label: 'Invalid',          color: 'text-danger',    bg: 'bg-danger/10',   icon: '❌' },
  { key: 'risky',      label: 'Risky',            color: 'text-warning',   bg: 'bg-warning/10',  icon: '⚠️' },
  { key: 'catch-all',  label: 'Catch-All',        color: 'text-purple',    bg: 'bg-purple/10',   icon: '🪣' },
];

export default function Dashboard() {
  const { user } = useAuth();

  const { data: statsData } = useQuery({
    queryKey: ['stats'],
    queryFn: () => analyticsService.getStats().then(r => r.data.data),
  });

  const { data: chartData } = useQuery({
    queryKey: ['chart'],
    queryFn: () => analyticsService.getChartData(14).then(r => r.data.data),
  });

  const stats = statsData || { total: 0, avgConfidence: 0, byStatus: { valid: 0, invalid: 0, risky: 0, 'catch-all': 0, unknown: 0 } };
  const daily = chartData?.daily || [];
  const topDomains = chartData?.topDomains || [];

  const pieData = [
    { name: 'Valid', value: stats.byStatus.valid },
    { name: 'Invalid', value: stats.byStatus.invalid },
    { name: 'Risky', value: stats.byStatus.risky },
    { name: 'Catch-All', value: stats.byStatus['catch-all'] },
    { name: 'Unknown', value: stats.byStatus.unknown },
  ].filter(d => d.value > 0);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-white/40 text-sm mt-1">Welcome back, {user?.name?.split(' ')[0]} 👋</p>
        </div>
        <Link to="/verify" className="btn-primary text-sm">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          Verify Email
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        {statCards.map(({ key, label, color, bg, icon }, i) => {
          const val = key === 'total' ? stats.total : stats.byStatus[key] || 0;
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="card p-5"
            >
              <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center text-base mb-4`}>{icon}</div>
              <div className={`text-2xl font-semibold tracking-tight ${color}`}>
                {val.toLocaleString()}
              </div>
              <div className="text-white/40 text-xs mt-1">{label}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Area Chart */}
        <div className="col-span-2 card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-sm">Daily Verification Volume</h2>
            <span className="text-xs text-white/30">Last 14 days</span>
          </div>
          {daily.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={daily} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f8ef7" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4f8ef7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="_id" tick={{ fill: '#555a6a', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#555a6a', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#181c22', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, color: '#e8eaf0', fontSize: 12 }} />
                <Area type="monotone" dataKey="count" stroke="#4f8ef7" strokeWidth={2} fill="url(#grad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </div>

        {/* Pie Chart */}
        <div className="card p-6">
          <h2 className="font-semibold text-sm mb-6">Status Distribution</h2>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={3} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#181c22', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, color: '#e8eaf0', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />
                      <span className="text-white/50">{d.name}</span>
                    </div>
                    <span className="text-white/70 font-medium">{d.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyChart />
          )}
        </div>
      </div>

      {/* Top Domains */}
      {topDomains.length > 0 && (
        <div className="card p-6">
          <h2 className="font-semibold text-sm mb-5">Top Verified Domains</h2>
          <div className="space-y-3">
            {topDomains.slice(0, 8).map((d, i) => (
              <div key={d._id} className="flex items-center gap-3 text-sm">
                <span className="text-white/20 text-xs w-4">{i + 1}</span>
                <span className="font-mono text-xs text-white/70 flex-1">{d._id}</span>
                <div className="flex-1 h-1.5 bg-bg-4 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-accent to-teal rounded-full"
                    style={{ width: `${Math.round((d.count / topDomains[0].count) * 100)}%` }} />
                </div>
                <span className="text-white/40 text-xs w-12 text-right">{d.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-40 flex items-center justify-center text-white/20 text-sm">
      No data yet — start verifying emails
    </div>
  );
}
