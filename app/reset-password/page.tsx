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
    }, 30000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: Session | null) => {
      if (event === 'PASSWORD_RECOVERY') { setReady(true); clearTimeout(timeout); }
      // Accept SIGNED_IN only if there's no error in the hash (i.e. a valid recovery link)
      if (event === 'SIGNED_IN' && session && !window.location.hash.includes('error')) {
        setReady(true);
        clearTimeout(timeout);
      }
    });

    return () => { subscription.unsubscribe(); clearTimeout(timeout); };
  // supabase is a singleton — stable across renders
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const t = setTimeout(() => router.replace('/'), 3000);
    return () => clearTimeout(t);
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ backgroundColor: '#0f0f11' }}>

      {/* ── Left panel — branding (desktop only) ── */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #13132b 0%, #1a1a3e 40%, #0f2a50 100%)' }}>

        <div className="absolute top-[-100px] right-[-80px] w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.22) 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-80px] left-[-60px] w-[320px] h-[320px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)' }} />
        <div className="absolute top-[40%] left-[20%] w-[240px] h-[240px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)' }} />

        {/* ── Logo ── */}
        <div className="relative z-10 flex items-center gap-4">
          <FinTrackLogo size={48} />
          <div>
            <div className="font-bold text-white" style={{ fontSize: '20px', letterSpacing: '-0.01em', lineHeight: 1 }}>FinTrack</div>
            <div style={{ fontSize: '10px', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.35)', marginTop: '5px' }}>SECURE YOUR ACCOUNT</div>
          </div>
        </div>

        {/* ── Hero copy ── */}
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-5 h-px" style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }} />
            <span style={{ fontSize: '11px', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.4)' }}>PASSWORD RESET</span>
          </div>

          <h2 style={{ fontSize: '42px', lineHeight: 1.1, letterSpacing: '-0.025em', marginBottom: '20px' }}>
            <span style={{ fontWeight: 300, color: 'rgba(255,255,255,0.7)' }}>Almost there —</span><br />
            <span style={{ fontWeight: 800, background: 'linear-gradient(90deg, #818cf8, #a78bfa, #38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              secure your account
            </span>
          </h2>

          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, marginBottom: '32px' }}>
            Choose a strong password to keep<br />your financial data safe.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              'Use a unique password not used elsewhere',
              'Mix letters, numbers, and symbols',
              'Longer passwords are stronger passwords',
            ].map(tip => (
              <div key={tip} className="flex items-center gap-3">
                <div className="shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }} />
                <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.72)' }}>{tip}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom note ── */}
        <div className="relative z-10 rounded-2xl p-5"
          style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}>
          <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'rgba(255,255,255,0.5)' }}>
            This link is valid for{' '}
            <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>1 hour</span>.
            {' '}After resetting, you&apos;ll be signed in automatically.
          </p>
        </div>
      </div>


      {/* ── Right panel — form ── */}
      <div className="flex-1 flex items-center justify-center overflow-y-auto"
        style={{
          backgroundColor: '#0f0f11',
          padding: 'max(2.5rem, env(safe-area-inset-top)) max(1.5rem, env(safe-area-inset-right)) max(2.5rem, env(safe-area-inset-bottom)) max(1.5rem, env(safe-area-inset-left))',
        }}>

        <div className="w-full" style={{ maxWidth: '400px' }}>

          {/* Mobile + tablet logo — glow + accent line, no banner */}
          <div className="flex lg:hidden flex-col items-center mb-8 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)', filter: 'blur(16px)' }} />
            <FinTrackLogo size={52} />
            <div className="mt-4 text-center" style={{ lineHeight: 1 }}>
              <span className="text-white text-2xl font-bold block" style={{ marginBottom: '5px' }}>FinTrack</span>
              <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em' }}>SECURE YOUR ACCOUNT</span>
            </div>
            <div className="mt-6 w-12 h-px rounded-full" style={{ background: 'linear-gradient(90deg, transparent, #6366f1, #8b5cf6, transparent)' }} />
          </div>

          <div>

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
                className="flex items-center justify-center w-full rounded-xl text-sm font-semibold text-center transition-all active:scale-[0.98] hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', boxShadow: '0 4px 20px rgba(99,102,241,0.35)', height: '52px' }}>
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
                      className="w-full px-4 pr-12 rounded-xl text-base outline-none transition-all disabled:opacity-40"
                      style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', height: '52px', fontSize: '16px' }}
                    />
                    <button type="button" tabIndex={-1} onClick={() => setShowPw(p => !p)}
                      className="absolute right-0 top-0 h-full px-4 flex items-center justify-center rounded-r-xl transition-opacity hover:opacity-70 active:opacity-50"
                      style={{ color: 'rgba(255,255,255,0.4)', minWidth: '48px' }}>
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
                      className="w-full px-4 pr-16 rounded-xl text-base outline-none transition-all disabled:opacity-40"
                      style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', height: '52px', fontSize: '16px' }}
                    />
                    {/* Match indicator */}
                    {confirm.length > 0 && (
                      <div className="absolute right-12 top-1/2 -translate-y-1/2 pointer-events-none">
                        {passwordsMatch
                          ? <span className="text-sm" style={{ color: '#22c55e' }}>✓</span>
                          : <span className="text-sm" style={{ color: '#f87171' }}>✗</span>}
                      </div>
                    )}
                    <button type="button" tabIndex={-1} onClick={() => setShowConfirm(p => !p)}
                      className="absolute right-0 top-0 h-full px-4 flex items-center justify-center rounded-r-xl transition-opacity hover:opacity-70 active:opacity-50"
                      style={{ color: 'rgba(255,255,255,0.4)', minWidth: '48px' }}>
                      {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
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
                  className="w-full rounded-xl text-sm font-semibold transition-all disabled:opacity-50 active:scale-[0.98] hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', boxShadow: '0 4px 20px rgba(99,102,241,0.35)', height: '52px' }}>
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
          </div>{/* end form wrapper */}
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

function FinTrackLogo({ size = 40 }: { size?: number }) {
  const r = size * 0.275;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, display: 'block', minWidth: size, filter: 'drop-shadow(0 4px 12px rgba(99,102,241,0.45))' }}>
      <defs>
        <linearGradient id="logoGradR" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx={r} fill="url(#logoGradR)" />
      <rect x="8"  y="22" width="6" height="10" rx="1.5" fill="white" fillOpacity="0.55" />
      <rect x="17" y="16" width="6" height="16" rx="1.5" fill="white" fillOpacity="0.8" />
      <rect x="26" y="10" width="6" height="22" rx="1.5" fill="white" fillOpacity="1" />
      <polyline points="11,21 20,15 29,9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.9" />
      <circle cx="29" cy="9" r="2" fill="white" fillOpacity="0.95" />
    </svg>
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
