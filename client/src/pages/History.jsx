import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { verifyService, downloadBlob } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import { reasonLabel } from '../lib/reasons';

const STATUSES = ['all', 'valid', 'invalid', 'risky', 'catch-all', 'unknown'];

export default function History() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['history', page, search, status],
    queryFn: () => verifyService.getHistory({
      page,
      limit: 20,
      ...(search && { search }),
      ...(status !== 'all' && { status }),
    }).then(r => r.data),
    placeholderData: (prev) => prev,
  });

  const verifications = data?.data || [];
  const pagination = data?.pagination || {};

  const handleExport = () => downloadBlob(
    verifyService.exportResults(status !== 'all' ? { status } : {}),
    `mailguard-history-${status}-${Date.now()}.csv`,
  ).then(() => toast.success('Exported')).catch(() => toast.error('Export failed'));

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Verification History</h1>
          <p className="text-white/40 text-sm mt-1">All your past email verifications</p>
        </div>
        <button onClick={handleExport} className="btn-ghost">
          <DownloadIcon /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="input w-72"
          placeholder="Search email..."
        />
        <div className="flex gap-1 bg-bg-2 border border-white/5 rounded-xl p-1">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize
                ${status === s ? 'bg-bg-4 text-white' : 'text-white/30 hover:text-white'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className={`transition-opacity ${isFetching ? 'opacity-50' : 'opacity-100'}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['Email', 'Status', 'Reason', 'Score', 'Mailbox', 'Disposable', 'Role', 'Checked'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-white/20 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/5">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-bg-4 rounded animate-pulse" style={{ width: j === 0 ? '160px' : '60px' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : verifications.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-white/20 text-sm">
                    No results match these filters
                  </td>
                </tr>
              ) : (
                verifications.map((v, i) => (
                  <motion.tr
                    key={v._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-white/80">{v.email}</td>
                    <td className="px-4 py-3"><StatusBadge status={v.status} /></td>
                    <td className="px-4 py-3 text-xs text-white/50" title={v.details}>{reasonLabel(v.reason)}</td>
                    <td className="px-4 py-3">
                      <ConfScore score={v.confidence} />
                    </td>
                    <td className="px-4 py-3 text-xs text-white/50 capitalize">{v.mailbox || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${v.disposable ? 'text-danger' : 'text-white/30'}`}>
                        {v.disposable ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${v.roleBased ? 'text-warning' : 'text-white/30'}`}>
                        {v.roleBased ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/30">
                      {new Date(v.createdAt).toLocaleDateString()}
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-4 py-4 border-t border-white/5 flex items-center justify-between">
            <span className="text-xs text-white/30">
              Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, pagination.total)} of {pagination.total?.toLocaleString()}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-30"
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConfScore({ score }) {
  if (score === null || score === undefined) return <span className="text-xs text-white/30">—</span>;
  const color = score >= 80 ? '#2ecc87' : score >= 50 ? '#f5a623' : '#f05252';
  return <span className="text-xs font-semibold" style={{ color }}>{score}%</span>;
}


function DownloadIcon() {
  return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
    <polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>;
}
