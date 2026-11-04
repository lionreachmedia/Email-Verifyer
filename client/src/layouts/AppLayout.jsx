import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { accountService } from '../services/api';
import Logo from '../components/Logo';

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

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* Sidebar */}
      <aside className="w-56 min-w-[224px] bg-bg-2 border-r border-white/5 flex flex-col">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/5">
          <div className="flex items-center gap-3"><Logo /></div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
                    {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) =>
              `flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all duration-150 text-sm
               ${isActive ? 'bg-accent/10 text-accent' : 'text-white/40 hover:text-white hover:bg-bg-4'}`
            }>
              {({ isActive }) => (
                <>
                  <Icon className={`w-4 h-4 ${isActive ? 'opacity-100' : 'opacity-60'}`} />
                  <span className="flex-1">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Credits */}
        <div className="p-4 border-t border-white/5">
          <div className="bg-bg-4 rounded-xl p-3">
            <div className="flex justify-between text-xs text-white/30 mb-2">
              <span>Credits</span><span>{user?.credits || 0} left</span>
            </div>
            <div className="h-1 bg-bg-3 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-accent to-purple rounded-full"
                style={{ width: `${Math.min(100, (user?.credits || 0) / 10)}%` }} />
            </div>
          </div>
          <button onClick={handleLogout}
            className="mt-3 w-full text-xs text-white/30 hover:text-white/60 transition-colors text-left px-1">
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {warning && (
          <div className="bg-warning/10 border-b border-warning/20 text-warning text-sm px-8 py-2.5 flex justify-between gap-4">
            <span>{warning}</span>
            <NavLink to="/settings" className="underline shrink-0">Details</NavLink>
          </div>
        )}
        <Outlet />
      </main>
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
