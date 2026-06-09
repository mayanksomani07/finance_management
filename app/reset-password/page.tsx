'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import type { Session } from '@supabase/supabase-js';

const PW_RULES = [
  { id: 'len',     label: 'At least 8 characters',       test: (p: string) => p.length >= 8 },
  { id: 'upper',   label: 'One uppercase letter (A–Z)',   test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lower',   label: 'One lowercase letter (a–z)',   test: (p: string) => /[a-z]/.test(p) },
  { id: 'number',  label: 'One number (0–9)',             test: (p: string) => /[0-9]/.test(p) },
  { id: 'special', label: 'One special character (!@#$)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

function getStrength(pw: string) {
  const passed = PW_RULES.filter(r => r.test(pw)).length;
  const score = Math.min(5, passed + (pw.length >= 12 ? 1 : 0));
  if (score <= 1) return { score, label: 'Weak',   color: '#ef4444' };
  if (score <= 3) return { score, label: 'Fair',   color: '#f59e0b' };
  if (score === 4) return { score, label: 'Good',  color: '#3b82f6' };
  return              { score, label: 'Strong', color: '#22c55e' };
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowser();
  const [password, setPassword]         = useState('');
  const [confirm, setConfirm]           = useState('');
  const [showPw, setShowPw]             = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [pwFocused, setPwFocused]       = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [done, setDone]                 = useState(false);
  const [ready, setReady]               = useState(false);
  const [linkExpired, setLinkExpired]   = useState(false);

  useEffect(() => {
    // If the URL contains an error from Supabase (expired/already used link),
    // detect it immediately from the hash fragment
    const hash = window.location.hash;
    if (hash.includes('error=') || hash.includes('error_code=')) {
      setLinkExpired(true);
      return;
    }

    // Timeout: if no PASSWORD_RECOVERY event fires within 8s, the link is invalid
    const timeout = setTimeout(() => {
      setLinkExpired(true);
    }, 8000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { setReady(true); clearTimeout(timeout); }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session: Session | null) => {
      if (event === 'PASSWORD_RECOVERY') { setReady(true); clearTimeout(timeout); }
      if (event === 'SIGNED_IN' && session) { setReady(true); clearTimeout(timeout); }
    });

    return () => { subscription.unsubscribe(); clearTimeout(timeout); };
  }, []);

  const allRulesPassed = PW_RULES.every(r => r.test(password));
  const passwordsMatch = confirm.length > 0 && password === confirm;
  const strength = getStrength(password);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!allRulesPassed) { setError('Please meet all password requirements.'); setPwFocused(true); return; }
    if (password !== confirm) { setError('Passwords do not match. Please re-enter.'); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setError(error.message); setLoading(false); return; }
    setDone(true);
    setTimeout(() => router.replace('/'), 3000);
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#0f0f11' }}>

      {/* ── Left panel — branding ── */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)' }}>
        <div className="absolute top-[-80px] right-[-80px] w-[360px] h-[360px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />
        <div className="absolute bottom-[-60px] left-[-60px] w-[280px] h-[280px] rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)' }} />
        <div className="absolute top-1/3 left-1/4 w-[200px] h-[200px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #06b6d4, transparent)' }} />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-lg"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              💰
            </div>
            <span className="text-white text-xl font-bold tracking-tight">FinTrack</span>
          </div>
        </div>

        {/* Center message */}
        <div className="relative z-10 space-y-6">
          <div>
            <h2 className="text-4xl font-bold text-white leading-tight mb-3">
              Almost there —<br />
              <span style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                secure your account
              </span>
            </h2>
            <p className="text-lg" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Choose a strong password to keep your financial data safe.
            </p>
          </div>

          {/* Security tips */}
          <div className="space-y-3">
            {[
              { icon: '🔑', text: 'Use a unique password not used elsewhere' },
              { icon: '🛡️', text: 'Mix letters, numbers, and symbols' },
              { icon: '🔒', text: 'Longer passwords are stronger passwords' },
            ].map(tip => (
              <div key={tip.text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                  style={{ backgroundColor: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)' }}>
                  {tip.icon}
                </div>
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{tip.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom note */}
        <div className="relative z-10 rounded-2xl p-5"
          style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)' }}>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 mt-0.5"
              style={{ backgroundColor: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)' }}>
              ℹ️
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
              This link is valid for <strong className="text-white">1 hour</strong>. After resetting, you&apos;ll be signed in automatically.
            </p>
          </div>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12"
        style={{ backgroundColor: '#0f0f11' }}>

        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            💰
          </div>
          <span className="text-white text-lg font-bold">FinTrack</span>
        </div>

        <div className="w-full max-w-sm">
          {linkExpired ? (
            /* ── Expired / invalid link ── */
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.08))', border: '1px solid rgba(239,68,68,0.3)' }}>
                  <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <defs>
                      <linearGradient id="expiredGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#ef4444" /><stop offset="100%" stopColor="#f97316" />
                      </linearGradient>
                    </defs>
                    <circle cx="12" cy="12" r="10" stroke="url(#expiredGrad)" />
                    <path d="M12 8v4" stroke="url(#expiredGrad)" strokeWidth="2" />
                    <circle cx="12" cy="16" r="1" fill="#ef4444" />
                  </svg>
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white mb-2">Link expired</h1>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  This password reset link has already been used or has expired. Reset links are valid for <strong className="text-white">1 hour</strong> and can only be used once.
                </p>
              </div>
              <a href="/login?screen=forgot"
                className="block w-full py-3 rounded-xl text-sm font-semibold text-center transition-all active:scale-[0.98] hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', boxShadow: '0 4px 20px rgba(99,102,241,0.35)' }}>
                Request a new reset link
              </a>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Remembered your password?{' '}
                <a href="/login" className="underline hover:opacity-70" style={{ color: '#6366f1' }}>Sign in</a>
              </p>
            </div>

          ) : done ? (
            /* ── Success ── */
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(16,185,129,0.15))', border: '1px solid rgba(34,197,94,0.3)' }}>
                  <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <defs>
                      <linearGradient id="checkGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#22c55e" /><stop offset="100%" stopColor="#10b981" />
                      </linearGradient>
                    </defs>
                    <circle cx="12" cy="12" r="10" stroke="url(#checkGrad)" />
                    <path d="m9 12 2 2 4-4" stroke="url(#checkGrad)" strokeWidth="2" />
                  </svg>
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white mb-2">Password updated!</h1>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Your password has been changed successfully.<br />Taking you to the app…
                </p>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                <div className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #22c55e, #10b981)', animation: 'shrink 3s linear forwards', transformOrigin: 'left' }} />
              </div>
            </div>

          ) : (
            /* ── Form ── */
            <div className="space-y-6">
              {/* Header */}
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">Set new password</h1>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {ready ? 'Choose a strong password for your account.' : 'Verifying your reset link…'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">

                {/* New password */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    New password
                  </label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      placeholder="Create a strong password"
                      value={password}
                      required
                      disabled={!ready}
                      onChange={e => setPassword(e.target.value)}
                      onFocus={e => { setPwFocused(true); e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)'; e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.07)'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
                      className="w-full px-4 py-3 pr-11 rounded-xl text-sm outline-none transition-all disabled:opacity-40"
                      style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                    />
                    <button type="button" tabIndex={-1} onClick={() => setShowPw(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-opacity hover:opacity-70"
                      style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {showPw ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>

                {/* Live requirements checklist */}
                {(pwFocused || password.length > 0) && (
                  <div className="rounded-xl px-4 py-3 space-y-2"
                    style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>Password requirements</p>
                    {PW_RULES.map(rule => {
                      const ok = rule.test(password);
                      return (
                        <div key={rule.id} className="flex items-center gap-2">
                          <span className="text-xs shrink-0 transition-colors" style={{ color: ok ? '#22c55e' : 'rgba(255,255,255,0.3)' }}>
                            {ok ? '✓' : '○'}
                          </span>
                          <span className="text-xs transition-colors" style={{ color: ok ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)' }}>
                            {rule.label}
                          </span>
                        </div>
                      );
                    })}
                    {password.length > 0 && (
                      <div className="pt-1 space-y-1">
                        <div className="flex gap-1">
                          {[1,2,3,4,5].map(i => (
                            <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
                              style={{ backgroundColor: i <= strength.score ? strength.color : 'rgba(255,255,255,0.1)' }} />
                          ))}
                        </div>
                        <p className="text-xs" style={{ color: strength.color }}>{strength.label} password</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Confirm password */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Confirm password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Re-enter your password"
                      value={confirm}
                      required
                      disabled={!ready}
                      onChange={e => setConfirm(e.target.value)}
                      onFocus={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)'; e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.07)'; }}
                      onBlur={e => {
                        const matchColor = confirm.length > 0 ? (password === confirm ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)') : 'rgba(255,255,255,0.1)';
                        e.currentTarget.style.borderColor = matchColor;
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                      }}
                      className="w-full px-4 py-3 pr-11 rounded-xl text-sm outline-none transition-all disabled:opacity-40"
                      style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                    />
                    <button type="button" tabIndex={-1} onClick={() => setShowConfirm(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-opacity hover:opacity-70"
                      style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                    {/* Match indicator */}
                    {confirm.length > 0 && (
                      <div className="absolute right-10 top-1/2 -translate-y-1/2">
                        {passwordsMatch
                          ? <span className="text-xs" style={{ color: '#22c55e' }}>✓</span>
                          : <span className="text-xs" style={{ color: '#f87171' }}>✗</span>}
                      </div>
                    )}
                  </div>
                  {confirm.length > 0 && !passwordsMatch && (
                    <p className="text-xs mt-1.5" style={{ color: '#f87171' }}>Passwords don&apos;t match</p>
                  )}
                  {passwordsMatch && (
                    <p className="text-xs mt-1.5" style={{ color: '#22c55e' }}>Passwords match</p>
                  )}
                </div>

                {/* Error */}
                {error && (
                  <div className="px-3 py-2.5 rounded-xl text-xs leading-relaxed"
                    style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button type="submit"
                  disabled={loading || !ready || (password.length > 0 && !allRulesPassed) || (confirm.length > 0 && !passwordsMatch)}
                  className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 active:scale-[0.98] hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', boxShadow: '0 4px 20px rgba(99,102,241,0.35)' }}>
                  {loading
                    ? <span className="flex items-center justify-center gap-2"><Spinner />Updating password…</span>
                    : !ready
                      ? <span className="flex items-center justify-center gap-2"><Spinner />Verifying link…</span>
                      : 'Update password'}
                </button>
              </form>

              <p className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Remembered your password?{' '}
                <a href="/login" className="underline transition-opacity hover:opacity-70" style={{ color: '#6366f1' }}>
                  Sign in
                </a>
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes shrink {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
      `}</style>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
