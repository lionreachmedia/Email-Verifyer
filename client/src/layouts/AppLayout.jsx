import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { accountService } from '../services/api';
import Logo from '../components/Logo';
import Patch from '../components/Patch';
import { useProviderCredits, LOW_CREDITS } from '../lib/useProviderCredits';

const navItems = [
  { to: '/', label: 'Dashboard', icon: GridIcon, end: true },
  { to: '/verify', label: 'Single Verify', icon: MailIcon },
  { to: '/bulk', label: 'Bulk Verify', icon: FileIcon },
  { to: '/history', label: 'History', icon: ClockIcon },
  { to: '/analytics', label: 'Analytics', icon: BarIcon },
  { to: '/settings', label: 'Settings', icon: GearIcon },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };
  const { data: status } = useQuery({
    queryKey: ['system-status'],
    queryFn: () => accountService.systemStatus().then((r) => r.data.data),
    refetchInterval: 60000,
  });
  const warning = status && (!status.mailboxChecksEnabled
    ? 'No mailbox checker is configured, so real addresses will come back as "unknown".'
    : !status.workerOnline ? 'The background worker is not running, so bulk lists will wait in the queue.' : null);

  const { data: pc } = useProviderCredits();
  const initials = (user?.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex w-[248px] shrink-0 bg-side border-r border-line flex-col">
        <div className="px-6 pt-6 pb-8"><Logo /></div>

        <nav className="flex-1 px-3 space-y-1" aria-label="Main">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) =>
              `relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors
               ${isActive ? 'bg-side-2 text-white font-medium' : 'text-white/55 hover:text-white hover:bg-side-2/60'}`
            }>
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-lime" aria-hidden="true" />}
                  <Icon className={`w-[18px] h-[18px] ${isActive ? 'text-lime' : ''}`} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 space-y-3">
          <CreditsWidget pc={pc} userCredits={user?.credits || 0} />
          <div className="flex items-center gap-3 px-1">
            <span className="w-8 h-8 rounded-full bg-side-3 text-white text-xs font-semibold flex items-center justify-center">{initials}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white truncate">{user?.name}</p>
              <button onClick={handleLogout} className="text-xs text-white/55 hover:text-white transition-colors">Sign out</button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile) */}
        <header className="lg:hidden bg-side border-b border-line px-4 pt-4">
          <div className="flex items-center justify-between pb-3">
            <Logo />
            <button onClick={handleLogout} className="text-xs text-white/60">Sign out</button>
          </div>
          <nav className="flex gap-1 overflow-x-auto pb-3 -mx-1 px-1" aria-label="Main">
            {navItems.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) =>
                `shrink-0 px-3 py-1.5 rounded-lg text-xs ${isActive ? 'bg-lime text-[#111A16] font-semibold' : 'text-white/60'}`
              }>{label}</NavLink>
            ))}
          </nav>
        </header>

        <main className="flex-1 overflow-y-auto">
          {warning && (
            <div className="bg-warn-soft border-b border-warn/25 text-warn text-sm px-6 lg:px-10 py-3 flex justify-between gap-4">
              <span>{warning}</span>
              <NavLink to="/settings" className="font-medium underline underline-offset-4 shrink-0">Details</NavLink>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function CreditsWidget({ pc, userCredits }) {
  // Reoon not in use: fall back to the user's MailGuard credits.
  if (pc && !pc.configured) {
    return (
      <div className="rounded-xl bg-side-2 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-white/55">Credits</span>
          <span className="text-lg font-semibold text-white">{userCredits.toLocaleString()}</span>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl bg-side-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-white/55">Reoon credits</span>
        {pc?.ok && pc.total < LOW_CREDITS && <Patch tone="warn" size="sm">Low</Patch>}
      </div>
      {!pc ? (
        <p className="text-lg font-semibold text-white/30 mt-1">…</p>
      ) : pc.ok ? (
        <>
          <p className="text-2xl font-semibold text-white mt-1">{pc.total.toLocaleString()}</p>
          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-white/[0.06]">
            <div><p className="text-[11px] text-white/45">Instant</p><p className="text-sm font-medium text-white">{(pc.instant ?? 0).toLocaleString()}</p></div>
            <div><p className="text-[11px] text-white/45">Daily</p><p className="text-sm font-medium text-white">{(pc.daily ?? 0).toLocaleString()}</p></div>
          </div>
        </>
      ) : (
        <p className="text-xs text-bad mt-2">Couldn&apos;t load balance: {pc.error}</p>
      )}
    </div>
  );
}

// Icons
function GridIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
  </svg>;
}
function MailIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>;
}
function FileIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/>
  </svg>;
}
function ClockIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>
  </svg>;
}
function BarIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>;
}
function GearIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>;
}
