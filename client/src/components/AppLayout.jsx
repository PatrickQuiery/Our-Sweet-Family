import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useClerk, useUser } from '@clerk/clerk-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import UsageMeter from './UsageMeter';
import LogoMark from './LogoMark';

const NAV_COLLAPSED_KEY = 'osf:navCollapsed';

// Whole-row account control: clicking anywhere on the user's name/avatar opens a
// menu with account management (Clerk's profile modal) and sign-out — so the name
// is a click path, not just the avatar.
const THEME_OPTIONS = [
  { key: 'light', label: 'Light', icon: SunIcon },
  { key: 'dark', label: 'Dark', icon: MoonIcon },
  { key: 'system', label: 'Auto', icon: AutoIcon },
];

// Compact segmented Light / Dark / Auto control for the account dropdown (DM-1).
function ThemeSegment() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="px-3 py-2">
      <div className="flex items-center gap-1 rounded-lg bg-ink/5 p-1">
        {THEME_OPTIONS.map(({ key, label, icon: Icon }) => {
          const active = theme === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTheme(key)}
              aria-pressed={active}
              className={`flex-1 flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? 'bg-surface text-ink shadow-sm'
                  : 'text-ink-muted hover:text-ink-soft'
              }`}
            >
              <Icon />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SunIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="4" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}
function AutoIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="18" height="12" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 20h8M12 16v4" />
    </svg>
  );
}

function UserMenu({ collapsed }) {
  const { user } = useAuth();
  const { user: clerkUser } = useUser();
  const clerk = useClerk();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // The profile photo is set through Clerk (Manage account), so prefer Clerk's
  // uploaded image; fall back to our local avatar, then initials.
  const avatarUrl = (clerkUser?.hasImage && clerkUser.imageUrl) || user?.avatarUrl || null;

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  const planColors = { free: 'bg-ink/5 text-ink-soft', plus: 'bg-blue-100 text-blue-700', premium: 'bg-brand-100 text-brand-700' };
  const initial = (user?.name?.[0] || '?').toUpperCase();

  return (
    <div className="relative" ref={ref}>
      {open && (
        <div className="absolute bottom-full mb-2 left-0 min-w-[210px] rounded-xl bg-surface shadow-soft border border-ink/5 py-1 z-50">
          <button
            onClick={() => { setOpen(false); clerk.openUserProfile(); }}
            className="w-full text-left px-3 py-2 text-sm text-ink-soft hover:bg-brand-50 dark:hover:bg-brand-500/10 hover:text-ink flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13 13 0 0112 15c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Manage account
          </button>
          <div className="my-1 border-t border-ink/5" />
          <ThemeSegment />
          <div className="my-1 border-t border-ink/5" />
          <button
            onClick={() => { setOpen(false); clerk.signOut({ redirectUrl: '/' }); }}
            className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Sign out
          </button>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        title={collapsed ? user?.name : undefined}
        className={`flex items-center gap-3 w-full rounded-xl px-2 py-2 hover:bg-brand-50/60 dark:hover:bg-brand-500/10 transition-colors ${collapsed ? 'justify-center' : ''}`}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-semibold text-sm flex-shrink-0">
            {initial}
          </div>
        )}
        {!collapsed && (
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-semibold text-ink truncate">{user?.name}</p>
            <span className={`badge text-xs ${planColors[user?.plan] || 'bg-ink/5 text-ink-soft'}`}>{user?.plan}</span>
          </div>
        )}
      </button>
    </div>
  );
}

const navSections = [
  {
    items: [
      { to: '/activity', label: 'Activity', icon: HeartIcon },
      { to: '/dashboard', label: 'Timeline', icon: HomeIcon },
      { to: '/upload', label: 'Upload', icon: UploadIcon },
      { to: '/reels', label: 'Reels', icon: FilmIcon },
      { to: '/milestones', label: 'Milestones', icon: StarIcon },
    ],
  },
  {
    heading: 'Manage',
    items: [
      { to: '/family', label: 'Family', icon: UsersIcon },
      { to: '/children', label: 'Children', icon: ChildIcon },
      { to: '/refer', label: 'Refer friends', icon: GiftIcon },
      { to: '/settings', label: 'Settings', icon: CogIcon },
    ],
  },
];

function GiftIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}
function UploadIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  );
}
function ChildIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function FilmIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
    </svg>
  );
}
function StarIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}
function CogIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

export default function AppLayout() {
  const { family } = useAuth();
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(NAV_COLLAPSED_KEY) === '1'; } catch { return false; }
  });
  const navigate = useNavigate();

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(NAV_COLLAPSED_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  return (
    <div
      className="min-h-screen flex"
      style={{ background: 'var(--app-gradient)', backgroundAttachment: 'fixed' }}
    >
      {/* Sidebar — frosted glass over the Sunrise wash. Width collapses to an icon rail on lg. */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 ${collapsed ? 'lg:w-20' : 'lg:w-64'} bg-surface/70 backdrop-blur-xl border-r border-white/40 dark:border-white/10 flex flex-col transition-[width,transform] duration-300 lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Collapse/expand — a bubble straddling the nav's right edge */}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand menu' : 'Collapse menu'}
          aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
          className="hidden lg:flex absolute top-7 -right-3 z-50 w-6 h-6 items-center justify-center rounded-full bg-surface border border-ink/10 shadow-md text-ink-muted hover:text-brand-500 hover:border-brand-300 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            {collapsed
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M15 5l-7 7 7 7" />}
          </svg>
        </button>

        {/* Logo */}
        <div className={`flex items-center justify-center border-b border-ink/5 ${collapsed ? 'px-2 py-4' : 'px-4 py-5'}`}>
          {collapsed ? (
            <LogoMark white={dark} size={34} />
          ) : (
            <img
              src="/brand/osf-5-compact-sunrise.svg"
              alt="Our Sweet Family"
              className="max-w-[176px] dark:brightness-0 dark:invert"
            />
          )}
        </div>

        {/* Family info */}
        {family && !collapsed && (
          <div className="px-4 py-3 border-b border-ink/5">
            <p className="text-xs text-ink-muted uppercase tracking-wide font-medium mb-1">Family</p>
            <p className="font-semibold text-ink text-sm truncate">{family.name}</p>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto overflow-x-hidden space-y-4">
          {navSections.map((section, i) => (
            <div key={section.heading || i}>
              {section.heading && !collapsed && (
                <p className="px-3 mb-1 text-xs text-ink-muted uppercase tracking-wide font-medium">
                  {section.heading}
                </p>
              )}
              <ul className="space-y-1">
                {section.items.map(({ to, label, icon: Icon }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      onClick={() => setMobileOpen(false)}
                      title={collapsed ? label : undefined}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-xl text-sm font-medium transition-colors ${collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'} ${
                          isActive
                            ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-200'
                            : 'text-ink-soft hover:bg-brand-50/60 dark:hover:bg-brand-500/10 hover:text-ink'
                        }`
                      }
                    >
                      <Icon />
                      {!collapsed && label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Storage usage vs plan */}
        {!collapsed && <UsageMeter />}

        {/* User — whole row is a click path to account management & sign-out */}
        <div className={`border-t border-ink/5 ${collapsed ? 'px-2 py-3' : 'px-4 py-3'}`}>
          <UserMenu collapsed={collapsed} />
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main content */}
      <div className={`flex-1 ${collapsed ? 'lg:ml-20' : 'lg:ml-64'} flex flex-col min-h-screen transition-[margin] duration-300`}>
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-surface/90 backdrop-blur border-b border-ink/5 sticky top-0 z-30">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="p-2 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-500/10"
          >
            <svg className="w-5 h-5 text-ink-soft" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <LogoMark white={dark} size={40} />
          <button
            onClick={() => navigate('/upload')}
            aria-label="Add a memory"
            className="p-2 rounded-lg bg-brand-500 text-white hover:bg-brand-600"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </header>

        <main className="flex-1 p-4 lg:p-6 max-w-6xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
