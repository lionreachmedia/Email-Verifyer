import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { verifyService, downloadBlob } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import Patch from '../components/Patch';
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
    <div className="page">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="page-title">Verification History</h1>
          <p className="page-sub">All your past email verifications</p>
        </div>
        <button onClick={handleExport} className="btn-ghost">
          <DownloadIcon /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 sm:items-center">
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="input sm:w-80"
          placeholder="Search email..."
        />
        <div className="flex gap-1 bg-surface border border-line rounded-xl p-1 overflow-x-auto" role="group" aria-label="Filter by result">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize
                ${status === s ? 'bg-lime text-[#111A16]' : 'text-muted hover:text-ink hover:bg-surface2'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className={`transition-opacity ${isFetching ? 'opacity-50' : 'opacity-100'}`}>
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr>
                {['Email', 'Status', 'Reason', 'Score', 'Mailbox', 'Disposable', 'Role', 'Checked'].map(h => (
                  <th key={h} className="th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-line">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-surface2 rounded animate-pulse" style={{ width: j === 0 ? '160px' : '60px' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : verifications.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-muted text-sm">
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
                    className="hover:bg-surface2/60 transition-colors"
                  >
                    <td className="td text-sm font-medium text-ink">{v.email}</td>
                    <td className="td"><StatusBadge status={v.status} /></td>
                    <td className="td text-xs text-muted" title={v.details}>{reasonLabel(v.reason)}</td>
                    <td className="td">
                      <ConfScore score={v.confidence} />
                    </td>
                    <td className="td text-xs text-muted capitalize">{v.mailbox || '—'}</td>
                    <td className="td">
                      <Patch tone={v.disposable ? 'bad' : 'unk'} size="sm">{v.disposable ? 'Yes' : 'No'}</Patch>
                    </td>
                    <td className="td">
                      <Patch tone={v.roleBased ? 'warn' : 'unk'} size="sm">{v.roleBased ? 'Yes' : 'No'}</Patch>
                    </td>
                    <td className="td text-xs text-muted">
                      {new Date(v.createdAt).toLocaleDateString()}
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table></div>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-4 py-4 border-t border-line flex items-center justify-between">
            <span className="text-xs text-muted">
              Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, pagination.total)} of {pagination.total?.toLocaleString()}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-30"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConfScore({ score }) {
  if (score === null || score === undefined) return <span className="text-xs text-muted">—</span>;
  const color = score >= 80 ? '#5CD08A' : score >= 50 ? '#F2B65A' : '#F47C6E';
  return <span className="text-xs font-semibold" style={{ color }}>{score}%</span>;
}


function DownloadIcon() {
  return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
    <polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>;
}
