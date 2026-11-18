import { useCallback, useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { verifyService, errorMessage, downloadBlob } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { JobStatus } from '../components/Patch';
import { useRefreshProviderCredits } from '../lib/useProviderCredits';
import { useUserCreditsEnabled } from '../lib/useSystemStatus';

const COUNTS = [
  ['valid', 'Valid', 'ok'],
  ['invalid', 'Invalid', 'bad'],
  ['risky', 'Risky', 'warn'],
  ['catchAll', 'Catch-all', 'catch'],
  ['unknown', 'Unknown', 'unk'],
];

export default function BulkVerify() {
  const { user, refreshUser } = useAuth();
  const refreshProviderCredits = useRefreshProviderCredits();
  const creditsOn = useUserCreditsEnabled();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [job, setJob] = useState(null);
  const [jobs, setJobs] = useState([]);
  const timer = useRef(null);

  const loadJobs = useCallback(async () => {
    try {
      const { data } = await verifyService.getJobs();
      setJobs(data.data);
      return data.data;
    } catch { return []; }
  }, []);

  // On open, resume the most recent job that's still running.
  useEffect(() => {
    loadJobs().then((list) => {
      const running = list.find((j) => j.status === 'queued' || j.status === 'processing');
      if (running) setJob(running);
    });
  }, [loadJobs]);

  // Poll while the job is running. No time limit: big lists can take hours.
  useEffect(() => {
    const active = job && (job.status === 'queued' || job.status === 'processing');
    if (!active) return undefined;
    const poll = async () => {
      try {
        const { data } = await verifyService.getBulkStatus(job.jobId);
        setJob(data.data);
        if (data.data.status === 'completed') { toast.success('Bulk verification finished'); refreshUser(); refreshProviderCredits(); loadJobs(); return; }
        if (data.data.status === 'failed') { toast.error(data.data.error || 'Job failed'); refreshUser(); loadJobs(); return; }
      } catch { /* network blip: keep polling */ }
      timer.current = setTimeout(poll, 2500);
    };
    timer.current = setTimeout(poll, 1000);
    return () => clearTimeout(timer.current);
  }, [job?.jobId, job?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const onDrop = useCallback((accepted, rejected) => {
    if (rejected.length) return toast.error(rejected[0].errors[0]?.code === 'file-too-large' ? 'File is larger than 20 MB' : 'Use a .csv or .txt file');
    if (accepted.length) setFile(accepted[0]);
    return undefined;
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, maxFiles: 1, maxSize: 20 * 1024 * 1024,
    accept: { 'text/csv': ['.csv'], 'text/plain': ['.txt'], 'application/vnd.ms-excel': ['.csv'] },
  });

  const upload = async () => {
    setUploading(true);
    try {
      const { data } = await verifyService.bulkUpload(file);
      toast.success(data.duplicatesRemoved ? `${data.message} ${data.duplicatesRemoved} duplicate${data.duplicatesRemoved === 1 ? "" : "s"} removed.` : data.message);
      setJob({ jobId: data.jobId, status: 'queued', totalEmails: data.totalEmails, processedEmails: 0, progress: 0, results: {}, fileName: file.name });
      setFile(null);
      refreshUser();
    } catch (err) {
      toast.error(errorMessage(err, 'Upload failed'), { duration: 6000 });
    } finally {
      setUploading(false);
    }
  };

  const exportJob = (j, status) => downloadBlob(
    verifyService.exportResults({ jobId: j.jobId, ...(status && { status }) }),
    `${(j.fileName || 'results').replace(/\.[^.]+$/, '')}-${status || 'all'}.csv`,
  ).catch(() => toast.error('Export failed'));

  const running = job && (job.status === 'queued' || job.status === 'processing');

  return (
    <div className="page">
      <div className="mb-8">
        <h1 className="page-title">Verify a list</h1>
        <p className="page-sub">
          Upload a CSV or TXT. Duplicates are removed automatically.
          {creditsOn && <> Each unique email uses 1 MailGuard credit, refunded for any we can&apos;t verify. You have <span className="font-semibold text-ink">{user?.credits?.toLocaleString() ?? 0}</span> MailGuard credits.</>}
        </p>
      </div>

      {job ? (
        <div className="card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-semibold">
                {job.status === 'completed' ? 'Finished' : job.status === 'failed' ? 'Failed' : job.status === 'queued' ? 'Waiting for the worker…' : 'Verifying…'}
              </p>
              <p className="text-xs text-muted mt-0.5">{job.fileName}: {(job.processedEmails || 0).toLocaleString()} of {(job.totalEmails || 0).toLocaleString()} emails</p>
            </div>
            <span className="text-[28px] leading-none font-semibold">{job.progress || 0}%</span>
          </div>
          <div className="h-2 bg-surface2 rounded-full overflow-hidden mb-5">
            <div className={`h-full rounded-full transition-all duration-500 ${job.status === 'failed' ? 'bg-bad' : job.status === 'completed' ? 'bg-ok' : 'bg-lime'}`} style={{ width: `${job.progress || 0}%` }} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {COUNTS.map(([key, label, tone]) => (
              <div key={key} className={`glass-tile patch-${tone} rounded-xl p-3 text-center`}>
                <div className="text-xl font-semibold">{(job.results?.[key] || 0).toLocaleString()}</div>
                <div className="text-xs mt-1 opacity-80">{label}</div>
              </div>
            ))}
          </div>
          {job.status === 'queued' && job.processedEmails === 0 && (
            <p className="text-xs text-warn mt-4">If this stays at 0% for more than a minute, the background worker isn't running. Start it with <code>npm run worker</code>.</p>
          )}
          {job.error && <p className="text-xs text-bad mt-4">{job.error}</p>}
          <div className="flex flex-wrap gap-3 mt-6">
            {job.status === 'completed' && (
              <>
                <button onClick={() => exportJob(job)} className="btn-primary">Download all results</button>
                <button onClick={() => exportJob(job, 'valid')} className="btn-ghost">Download valid only</button>
              </>
            )}
            <button onClick={() => setJob(null)} className="btn-ghost">{running ? 'Hide (keeps running)' : 'Upload another file'}</button>
          </div>
        </div>
      ) : (
        <>
          <div {...getRootProps()} className={`card border-2 border-dashed px-6 py-14 text-center cursor-pointer transition-colors mb-4 ${isDragActive ? 'border-lime bg-lime/[0.06]' : 'border-side-3 hover:border-lime/50'}`}>
            <input {...getInputProps()} />
            {file ? (
              <>
                <UploadIcon />
                <p className="font-semibold text-ink mt-4">{file.name}</p>
                <p className="text-sm text-muted mt-1.5">{(file.size / 1024).toFixed(1)} KB, ready to verify</p>
              </>
            ) : (
              <>
                <UploadIcon />
                <p className="font-semibold mt-4 mb-1.5">{isDragActive ? 'Drop the file here' : 'Drop a CSV or TXT here, or click to choose'}</p>
                <p className="text-muted text-sm">Up to 100,000 emails or 20 MB</p>
              </>
            )}
          </div>
          <div className="flex gap-3 mb-6">
            <button onClick={upload} disabled={!file || uploading} className="btn-primary">{uploading ? 'Uploading…' : 'Start verification'}</button>
            {file && <button onClick={() => setFile(null)} className="btn-ghost">Clear</button>}
          </div>
          <div className="card p-6 mb-6 text-sm text-muted">
            <p className="font-semibold text-ink mb-2">Accepted formats</p>
            <p>A CSV with a column called <code className="bg-surface2 border border-line px-1.5 py-0.5 rounded text-ink">email</code> (or "Email Address", "E-mail"…), or a plain list with one email per line. Other columns are ignored.</p>
          </div>
        </>
      )}

      {jobs.length > 0 && (
        <div className="card overflow-hidden">
          <h2 className="font-semibold px-6 pt-5 pb-3">Recent uploads</h2>
          <table className="w-full text-sm">
            <tbody>
              {jobs.map((j) => (
                <tr key={j.jobId} className="border-t border-line">
                  <td className="px-6 py-3 truncate max-w-[220px]">{j.fileName}</td>
                  <td className="px-3 py-3 text-muted text-xs">{j.totalEmails.toLocaleString()} emails</td>
                  <td className="px-3 py-3"><JobStatus job={j} /></td>
                  <td className="px-3 py-3 text-xs text-muted">{new Date(j.createdAt).toLocaleString()}</td>
                  <td className="px-6 py-3 text-right">
                    {j.status === 'completed'
                      ? <button onClick={() => exportJob(j)} className="link text-xs">Download</button>
                      : <button onClick={() => setJob(j)} className="link text-xs">View</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UploadIcon() {
  return (
    <span className="mx-auto w-12 h-12 rounded-2xl bg-lime flex items-center justify-center" aria-hidden="true">
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#111A16" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    </span>
  );
}
