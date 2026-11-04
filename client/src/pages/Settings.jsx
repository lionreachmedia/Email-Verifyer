import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { accountService, errorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PROVIDER_NAMES } from '../lib/reasons';

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [newKey, setNewKey] = useState(null);
  const { data: status, refetch } = useQuery({ queryKey: ['system-status'], queryFn: () => accountService.systemStatus().then((r) => r.data.data) });

  const saveName = async (e) => {
    e.preventDefault();
    try { await accountService.updateProfile(name); await refreshUser(); toast.success('Name saved'); } catch (err) { toast.error(errorMessage(err)); }
  };

  const createKey = async () => {
    if (user?.apiKeyPrefix && !window.confirm('This replaces your current API key. Apps using the old key will stop working. Continue?')) return;
    try { const { data } = await accountService.createApiKey(); setNewKey(data.apiKey); refreshUser(); } catch (err) { toast.error(errorMessage(err)); }
  };

  const revokeKey = async () => {
    if (!window.confirm('Revoke your API key? Apps using it will stop working.')) return;
    try { await accountService.revokeApiKey(); setNewKey(null); refreshUser(); toast.success('API key revoked'); } catch (err) { toast.error(errorMessage(err)); }
  };

  // Separate API domain (VITE_API_URL) or same domain (/api).
  const configured = import.meta.env.VITE_API_URL;
  const apiBase = configured && /^https?:\/\//.test(configured) ? configured.replace(/\/+$/, '') : `${window.location.origin}/api`;

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-white/40 text-sm mt-1">Your account, API access and checker status</p>
      </div>

      <section className="card p-6">
        <h2 className="font-semibold text-sm mb-4">Account</h2>
        <form onSubmit={saveName} className="flex gap-3 mb-4">
          <input value={name} onChange={(e) => setName(e.target.value)} className="input flex-1 font-sans" aria-label="Name" />
          <button className="btn-ghost" type="submit">Save</button>
        </form>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <dt className="text-white/40">Email</dt><dd>{user?.email}</dd>
          <dt className="text-white/40">Credits left</dt><dd>{user?.credits?.toLocaleString()}</dd>
          <dt className="text-white/40">Emails verified</dt><dd>{user?.totalVerified?.toLocaleString()}</dd>
        </dl>
      </section>

      <section className="card p-6">
        <h2 className="font-semibold text-sm mb-1">API key</h2>
        <p className="text-sm text-white/40 mb-4">Verify emails from your own apps. Requests use the same credits as the dashboard.</p>
        {newKey ? (
          <div className="mb-4">
            <p className="text-xs text-warning mb-2">Copy this key now. It won't be shown again.</p>
            <div className="flex gap-2">
              <code className="input flex-1 break-all">{newKey}</code>
              <button className="btn-ghost" onClick={() => navigator.clipboard.writeText(newKey).then(() => toast.success('Copied'))}>Copy</button>
            </div>
          </div>
        ) : user?.apiKeyPrefix ? (
          <p className="text-sm mb-4">Active key: <code className="text-white/70">{user.apiKeyPrefix}…</code> created {new Date(user.apiKeyCreatedAt).toLocaleDateString()}</p>
        ) : <p className="text-sm text-white/40 mb-4">No API key yet.</p>}
        <div className="flex gap-3 mb-5">
          <button onClick={createKey} className="btn-primary">{user?.apiKeyPrefix ? 'Replace key' : 'Create API key'}</button>
          {user?.apiKeyPrefix && <button onClick={revokeKey} className="btn-ghost">Revoke</button>}
        </div>
        <pre className="bg-bg-3 rounded-xl p-4 text-xs text-white/60 overflow-x-auto">{`curl -X POST ${apiBase}/verify/single \\
  -H "x-api-key: YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"someone@company.com"}'`}</pre>
      </section>

      <section className="card p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-sm">System status</h2>
          <button onClick={() => refetch()} className="text-xs text-accent">Refresh</button>
        </div>
        {!status ? <p className="text-sm text-white/40">Loading…</p> : (
          <ul className="space-y-2 text-sm">
            <StatusRow ok={status.workerOnline} label="Background worker (bulk lists)" bad="Not running: start it with npm run worker" />
            <StatusRow ok={status.mailConfigured} label="Outgoing email (sign-up codes)" bad="Not configured: codes print in the server console" warnOnly />
            {status.providers.map((p, i) => (
              <StatusRow key={p.name} ok={p.configured} label={`Checker ${i + 1}: ${PROVIDER_NAMES[p.name] || p.name}`} bad={p.note} />
            ))}
            {!status.mailboxChecksEnabled && <li className="text-danger text-xs pt-2">No mailbox checker is configured, so real addresses will come back as "unknown". See the setup guide.</li>}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusRow({ ok, label, bad, warnOnly }) {
  return (
    <li className="flex items-start justify-between gap-4">
      <span>{label}</span>
      <span className={`text-xs text-right ${ok ? 'text-success' : warnOnly ? 'text-warning' : 'text-danger'}`}>{ok ? 'OK' : bad}</span>
    </li>
  );
}
