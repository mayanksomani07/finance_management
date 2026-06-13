'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import type { Session } from '@supabase/supabase-js';

const PROVIDERS = [
  { id: 'google', label: 'Google', icon: GoogleIcon },
  { id: 'github', label: 'GitHub', icon: GitHubIcon },
] as const;

type Provider = typeof PROVIDERS[number]['id'];
type Screen = 'login' | 'signup' | 'forgot' | 'verify' | 'forgot-sent';

const FEATURES = [
  { icon: '📊', text: 'Real-time spending insights' },
  { icon: '🔒', text: 'Bank-grade security' },
  { icon: '⚡', text: 'Instant transaction sync' },
  { icon: '🎯', text: 'Smart budget tracking' },
];

const PW_RULES = [
  { id: 'len',     label: 'At least 8 characters',       test: (p: string) => p.length >= 8 },
  { id: 'upper',   label: 'One uppercase letter (A–Z)',   test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lower',   label: 'One lowercase letter (a–z)',   test: (p: string) => /[a-z]/.test(p) },
  { id: 'number',  label: 'One number (0–9)',             test: (p: string) => /[0-9]/.test(p) },
  { id: 'special', label: 'One special character (!@#$)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  const passed = PW_RULES.filter(r => r.test(pw)).length;
  const score = Math.min(5, passed + (pw.length >= 12 ? 1 : 0));
  if (score <= 1) return { score, label: 'Weak',   color: '#ef4444' };
  if (score <= 3) return { score, label: 'Fair',   color: '#f59e0b' };
  if (score === 4) return { score, label: 'Good',  color: '#3b82f6' };
  return              { score, label: 'Strong', color: '#22c55e' };
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = getSupabaseBrowser();
  const [screen, setScreen]           = useState<Screen>(
    searchParams.get('screen') === 'forgot' ? 'forgot' : 'login'
  );
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [name, setName]               = useState('');
  const [showPw, setShowPw]           = useState(false);
  const [loading, setLoading]         = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<{ label: string; screen: Screen } | null>(null);
  const [success, setSuccess]         = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [pwFocused, setPwFocused]     = useState(false);

  // Admin status is resolved server-side (ADMIN_EMAIL is server-only) — send the
  // admin to /admin, everyone else to /. Defaults to / if the check fails.
  // redirectingRef prevents the double-fire from getSession + onAuthStateChange.
  const redirectingRef = useRef(false);
  async function redirectAfterAuth() {
    if (redirectingRef.current) return;
    redirectingRef.current = true;
    try {
      const res = await fetch('/api/auth/is-admin');
      const { isAdmin } = await res.json() as { isAdmin: boolean };
      router.replace(isAdmin ? '/admin' : '/');
    } catch {
      router.replace('/');
    }
  }

  useEffect(() => {
    const auth = supabase.auth;
    auth.getSession().then((res: { data: { session: Session | null } }) => {
      if (res.data.session) void redirectAfterAuth();
    });
    const { data: { subscription } } = auth.onAuthStateChange((_event: string, session: Session | null) => {
      if (session) void redirectAfterAuth();
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetMessages() { setError(null); setErrorAction(null); setSuccess(null); }
  function go(s: Screen) { setScreen(s); resetMessages(); setShowPw(false); setPwFocused(false); }
  function setErr(msg: string, action?: { label: string; screen: Screen }) {
    setError(msg); setErrorAction(action ?? null);
  }

  async function checkEmail(em: string): Promise<boolean> {
    const res = await fetch('/api/auth/check-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: em }),
    });
    if (!res.ok) throw new Error('api_error');
    const { exists } = await res.json();
    return exists as boolean;
  }

  async function handleSocialLogin(provider: Provider) {
    setLoading(provider); resetMessages();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
    if (error) {
      setErr(
        error.message.toLowerCase().includes('provider') || error.message.toLowerCase().includes('not enabled')
          ? `${provider} login isn't enabled yet.`
          : 'Could not connect. Please try again.'
      );
      setLoading(null);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading('submit'); resetMessages();
    try {
      const exists = await checkEmail(email);
      if (!exists) {
        setErr('No account found for this email.', { label: 'Sign up free', screen: 'signup' });
        setLoading(null); return;
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setErr('Incorrect password. Please check and try again.'); setLoading(null); return; }
      if (data.session) await redirectAfterAuth();
    } catch {
      setErr('Could not sign in. Please check your connection and try again.');
      setLoading(null);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault(); resetMessages();
    if (!name.trim()) { setErr('Please enter your full name.'); return; }
    const failedRules = PW_RULES.filter(r => !r.test(password));
    if (failedRules.length) { setErr('Password must meet all requirements below.'); setPwFocused(true); return; }
    setLoading('submit');
    try {
      // The admin account already exists, so the existing-account check below
      // (checkEmail) blocks signing up with it — no separate reserved-email guard needed.
      const exists = await checkEmail(email);
      if (exists) {
        setErr('An account with this email already exists.', { label: 'Sign in instead', screen: 'login' });
        setLoading(null); return;
      }
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: name.trim() }, emailRedirectTo: `${location.origin}/auth/callback` },
      });
      if (error) { setErr('Could not create your account. Please try again.'); }
      else { setScreen('verify'); startResendCooldown(); }
    } catch {
      setErr('Could not create your account. Please check your connection and try again.');
    }
    setLoading(null);
  }

  function startResendCooldown() {
    setResendCooldown(60);
    const t = setInterval(() => {
      setResendCooldown(n => { if (n <= 1) { clearInterval(t); return 0; } return n - 1; });
    }, 1000);
    return t;
  }

  async function handleResend() {
    setLoading('resend'); resetMessages();
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) { setErr(error.message); }
    else { setSuccess('Confirmation email resent!'); startResendCooldown(); }
    setLoading(null);
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault(); setLoading('submit'); resetMessages();
    try {
      const exists = await checkEmail(email);
      if (!exists) {
        setErr('No account found for this email.', { label: 'Create an account', screen: 'signup' });
        setLoading(null); return;
      }
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${location.origin}/reset-password`,
      });
      if (error) {
        const msg = error.message.toLowerCase();
        setErr(
          msg.includes('rate limit') || msg.includes('too many') || msg.includes('exceeded')
            ? 'Too many reset emails sent. Please wait a few minutes before trying again.'
            : error.message
        );
        setLoading(null); return;
      }
      setScreen('forgot-sent');
    } catch {
      setErr('Could not send reset email. Please check your connection and try again.');
    }
    setLoading(null);
  }

  const isLoading = loading !== null;
  const pwStrength = getPasswordStrength(password);
  const allRulesPassed = PW_RULES.every(r => r.test(password));

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ backgroundColor: '#09090b' }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }
        .auth-panel { animation: fadeUp 0.4s ease both; }
        .social-btn:hover { background: rgba(255,255,255,0.1) !important; transform: translateY(-1px); }
        .social-btn:active { transform: translateY(0) scale(0.98); }
        .submit-btn:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); box-shadow: 0 8px 30px rgba(99,102,241,0.5) !important; }
        .submit-btn:active:not(:disabled) { transform: translateY(0) scale(0.98); }
        input::placeholder { color: rgba(255,255,255,0.28); }
        .feature-dot { animation: shimmer 3s ease-in-out infinite; }
        .feature-dot:nth-child(2) { animation-delay: 0.5s; }
        .feature-dot:nth-child(3) { animation-delay: 1s; }
        .feature-dot:nth-child(4) { animation-delay: 1.5s; }
      `}</style>

      {/* ── Left panel — branding (desktop only) ── */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #13132b 0%, #1a1a3e 40%, #0f2a50 100%)' }}>

        {/* Ambient blobs */}
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
            <div style={{ fontSize: '10px', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.35)', marginTop: '5px' }}>TRACK EVERY RUPEE</div>
          </div>
        </div>

        {/* ── Hero copy ── */}
        <div className="relative z-10">
          {/* Eyebrow */}
          <div className="flex items-center gap-2 mb-5">
            <div className="w-5 h-px" style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }} />
            <span style={{ fontSize: '11px', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.4)' }}>PERSONAL FINANCE</span>
          </div>

          <h2 style={{ fontSize: '42px', lineHeight: 1.1, letterSpacing: '-0.025em', marginBottom: '20px' }}>
            <span style={{ fontWeight: 300, color: 'rgba(255,255,255,0.7)' }}>Take control of</span><br />
            <span style={{ fontWeight: 800, background: 'linear-gradient(90deg, #818cf8, #a78bfa, #38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              your finances
            </span>
          </h2>

          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, marginBottom: '32px' }}>
            Track every rupee, spot trends, and<br />hit your savings goals — effortlessly.
          </p>

          {/* Feature list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {FEATURES.map(f => (
              <div key={f.text} className="flex items-center gap-3">
                <div className="shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }} />
                <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.72)', fontWeight: 400 }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Testimonial ── */}
        <div className="relative z-10 rounded-2xl p-5"
          style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}>
          <p style={{ fontSize: '14px', fontStyle: 'italic', lineHeight: 1.6, color: 'rgba(255,255,255,0.65)', marginBottom: '14px' }}>
            &ldquo;Finally, a finance app that doesn&rsquo;t feel like a spreadsheet.&rdquo;
          </p>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              M
            </div>
            <div>
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>Mayank S.</p>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>Saved ₹40k in 3 months</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex items-center justify-center min-h-screen"
        style={{
          backgroundColor: '#09090b',
          padding: 'max(2rem, env(safe-area-inset-top)) max(1.5rem, env(safe-area-inset-right)) max(2rem, env(safe-area-inset-bottom)) max(1.5rem, env(safe-area-inset-left))',
        }}>

        <div className="w-full" style={{ maxWidth: '400px' }}>

          {/* Mobile logo */}
          <div className="flex lg:hidden flex-col items-center mb-10">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl"
                style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)', filter: 'blur(20px)', transform: 'scale(1.5)' }} />
              <FinTrackLogo size={52} />
            </div>
            <div className="mt-4 text-center">
              <span className="text-white text-xl font-bold block" style={{ letterSpacing: '-0.02em' }}>FinTrack</span>
              <span style={{ fontSize: '9px', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)', display: 'block', marginTop: '4px' }}>TRACK EVERY RUPEE</span>
            </div>
          </div>

          <div className="auth-panel">

            {/* ── Email verification ── */}
            {screen === 'verify' && (
              <div className="space-y-6 text-center">
                <div className="flex justify-center">
                  <div className="w-18 h-18 rounded-2xl flex items-center justify-center relative"
                    style={{ width: 72, height: 72, background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))', border: '1px solid rgba(99,102,241,0.25)' }}>
                    <div className="absolute inset-0 rounded-2xl" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)', filter: 'blur(8px)' }} />
                    <svg className="w-9 h-9 relative z-10" viewBox="0 0 24 24" fill="none" stroke="url(#emailGrad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <defs><linearGradient id="emailGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#8b5cf6" /></linearGradient></defs>
                      <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white mb-2" style={{ letterSpacing: '-0.02em' }}>Check your inbox</h1>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>We sent a confirmation link to</p>
                  <p className="text-sm font-semibold mt-1.5 px-3 py-1.5 rounded-lg inline-block" style={{ color: 'rgba(255,255,255,0.9)', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>{email}</p>
                  <p className="text-sm mt-3" style={{ color: 'rgba(255,255,255,0.35)' }}>Click it to activate your account. Check spam if you don&apos;t see it.</p>
                </div>
                {error   && <Alert type="error"   msg={error} />}
                {success && <Alert type="success" msg={success} />}
                <div className="space-y-3">
                  <button type="button" onClick={handleResend} disabled={resendCooldown > 0 || loading === 'resend'}
                    className="w-full rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                    style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', height: '50px' }}>
                    {loading === 'resend' ? <span className="flex items-center justify-center gap-2"><Spinner />Resending…</span>
                      : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend confirmation email'}
                  </button>
                  <button type="button" onClick={() => go('login')}
                    className="w-full text-sm font-medium transition-opacity hover:opacity-70 py-3"
                    style={{ color: 'rgba(255,255,255,0.35)' }}>← Back to sign in</button>
                </div>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.22)' }}>
                  Wrong email?{' '}
                  <button type="button" onClick={() => go('signup')} className="underline transition-opacity hover:opacity-70">Sign up again</button>
                </p>
              </div>
            )}

            {/* ── Forgot password ── */}
            {screen === 'forgot' && (
              <div className="space-y-6">
                <div>
                  <button type="button" onClick={() => go('login')} className="flex items-center gap-1.5 text-xs font-medium mb-6 transition-opacity hover:opacity-70" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                    Back
                  </button>
                  <h1 className="text-2xl font-bold text-white mb-1.5" style={{ letterSpacing: '-0.02em' }}>Reset your password</h1>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Enter your email and we&apos;ll send you a reset link</p>
                </div>
                <form onSubmit={handleForgot} className="space-y-3">
                  <InputField type="email" placeholder="Email address" value={email} onChange={setEmail} />
                  {error && (
                    <Alert type="error" msg={error}>
                      {errorAction && (
                        <button type="button" onClick={() => go(errorAction.screen)} className="ml-1 font-semibold underline hover:opacity-80">{errorAction.label}</button>
                      )}
                    </Alert>
                  )}
                  <SubmitBtn loading={isLoading} label="Send reset link" loadingLabel="Sending…" />
                </form>
              </div>
            )}

            {/* ── Forgot — link sent ── */}
            {screen === 'forgot-sent' && (
              <div className="space-y-6 text-center">
                <div className="flex justify-center">
                  <div className="relative flex items-center justify-center" style={{ width: 72, height: 72 }}>
                    <div className="absolute inset-0 rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))', border: '1px solid rgba(99,102,241,0.25)' }} />
                    <div className="absolute inset-0 rounded-2xl" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)', filter: 'blur(8px)' }} />
                    <svg className="w-9 h-9 relative z-10" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <defs><linearGradient id="lockGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#8b5cf6" /></linearGradient></defs>
                      <rect x="3" y="11" width="18" height="11" rx="2" stroke="url(#lockGrad)" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="url(#lockGrad)" />
                      <circle cx="12" cy="16" r="1.5" fill="#8b5cf6" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white mb-2" style={{ letterSpacing: '-0.02em' }}>Check your inbox</h1>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>We sent a password reset link to</p>
                  <p className="text-sm font-semibold mt-1.5 px-3 py-1.5 rounded-lg inline-block" style={{ color: 'rgba(255,255,255,0.9)', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>{email}</p>
                  <p className="text-sm mt-3" style={{ color: 'rgba(255,255,255,0.35)' }}>The link expires in 1 hour. Check spam if you don&apos;t see it.</p>
                </div>
                <button type="button" onClick={() => go('login')}
                  className="w-full rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', height: '50px' }}>
                  Back to sign in
                </button>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.22)' }}>
                  Wrong email?{' '}
                  <button type="button" onClick={() => go('forgot')} className="underline transition-opacity hover:opacity-70">Try again</button>
                </p>
              </div>
            )}

            {/* ── Sign up ── */}
            {screen === 'signup' && (
              <div className="space-y-5">
                <div>
                  <h1 className="text-2xl font-bold text-white mb-1" style={{ letterSpacing: '-0.02em' }}>Create your account</h1>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Free forever · no credit card needed</p>
                </div>

                <form onSubmit={handleSignup} className="space-y-3">
                  <InputField type="text"  placeholder="Full name"      value={name}     onChange={setName} />
                  <InputField type="email" placeholder="Email address"  value={email}    onChange={setEmail} />
                  <PasswordField
                    placeholder="Create a password"
                    value={password} onChange={setPassword}
                    show={showPw} onToggle={() => setShowPw(p => !p)}
                    onFocus={() => setPwFocused(true)}
                  />

                  {(pwFocused || password.length > 0) && (
                    <div className="rounded-xl px-4 py-3 space-y-2"
                      style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <p className="text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Password requirements</p>
                      {PW_RULES.map(rule => {
                        const ok = rule.test(password);
                        return (
                          <div key={rule.id} className="flex items-center gap-2">
                            <div className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center transition-all"
                              style={{ backgroundColor: ok ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${ok ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}` }}>
                              {ok && <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                            </div>
                            <span className="text-xs transition-colors" style={{ color: ok ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)' }}>{rule.label}</span>
                          </div>
                        );
                      })}
                      {password.length > 0 && (
                        <div className="pt-1.5 space-y-1.5">
                          <div className="flex gap-1">
                            {[1,2,3,4,5].map(i => (
                              <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
                                style={{ backgroundColor: i <= pwStrength.score ? pwStrength.color : 'rgba(255,255,255,0.08)' }} />
                            ))}
                          </div>
                          <p className="text-xs font-medium" style={{ color: pwStrength.color }}>{pwStrength.label} password</p>
                        </div>
                      )}
                    </div>
                  )}

                  {error && (
                    <Alert type="error" msg={error}>
                      {errorAction && (
                        <button type="button" onClick={() => go(errorAction.screen)} className="ml-1 font-semibold underline hover:opacity-80">{errorAction.label}</button>
                      )}
                    </Alert>
                  )}
                  {success && <Alert type="success" msg={success} />}

                  <SubmitBtn loading={isLoading} label="Create account" loadingLabel="Creating account…" disabled={password.length > 0 && !allRulesPassed} />
                </form>

                <Divider label="or sign up with" />
                <SocialGrid providers={PROVIDERS} loading={loading} disabled={isLoading} onLogin={handleSocialLogin} />

                <p className="text-center text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Already have an account?{' '}
                  <button type="button" onClick={() => go('login')} className="font-semibold transition-opacity hover:opacity-70" style={{ color: '#818cf8' }}>Sign in</button>
                </p>
              </div>
            )}

            {/* ── Login ── */}
            {screen === 'login' && (
              <div className="space-y-5">
                <div>
                  <h1 className="text-2xl font-bold text-white mb-1" style={{ letterSpacing: '-0.02em' }}>Welcome back</h1>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Sign in to your FinTrack account</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-3">
                  <InputField type="email" placeholder="Email address" value={email} onChange={setEmail} />
                  <div className="space-y-1">
                    <PasswordField placeholder="Password" value={password} onChange={setPassword} show={showPw} onToggle={() => setShowPw(p => !p)} />
                    <div className="flex justify-end pt-0.5">
                      <button type="button" onClick={() => go('forgot')}
                        className="text-xs font-medium transition-opacity hover:opacity-70 py-1" style={{ color: '#818cf8' }}>
                        Forgot password?
                      </button>
                    </div>
                  </div>
                  {error && (
                    <Alert type="error" msg={error}>
                      {errorAction && (
                        <button type="button" onClick={() => go(errorAction.screen)} className="ml-1 font-semibold underline hover:opacity-80">{errorAction.label}</button>
                      )}
                    </Alert>
                  )}
                  {success && <Alert type="success" msg={success} />}
                  <SubmitBtn loading={isLoading} label="Sign in" loadingLabel="Signing in…" />
                </form>

                <Divider label="or continue with" />
                <SocialGrid providers={PROVIDERS} loading={loading} disabled={isLoading} onLogin={handleSocialLogin} />

                <p className="text-center text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Don&apos;t have an account?{' '}
                  <button type="button" onClick={() => go('signup')} className="font-semibold transition-opacity hover:opacity-70" style={{ color: '#818cf8' }}>
                    Sign up free
                  </button>
                </p>
              </div>
            )}

            <p className="text-xs text-center mt-8" style={{ color: 'rgba(255,255,255,0.18)' }}>
              By continuing you agree to our Terms &amp; Privacy Policy
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FinTrackLogo({ size = 40 }: { size?: number }) {
  const r = size * 0.275;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, display: 'block', minWidth: size, filter: 'drop-shadow(0 4px 14px rgba(99,102,241,0.5))' }}>
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx={r} fill="url(#logoGrad)" />
      <rect x="8"  y="22" width="6" height="10" rx="1.5" fill="white" fillOpacity="0.5" />
      <rect x="17" y="16" width="6" height="16" rx="1.5" fill="white" fillOpacity="0.75" />
      <rect x="26" y="10" width="6" height="22" rx="1.5" fill="white" />
      <polyline points="11,21 20,15 29,9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.9" />
      <circle cx="29" cy="9" r="2" fill="white" />
    </svg>
  );
}

function InputField({ type, placeholder, value, onChange }: {
  type: string; placeholder: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <input
      type={type} placeholder={placeholder} value={value} required
      onChange={e => onChange(e.target.value)}
      className="w-full px-4 rounded-xl text-base outline-none transition-all"
      style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: '#fff', height: '50px', fontSize: '16px' }}
      onFocus={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.55)'; e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.06)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }}
      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.boxShadow = 'none'; }}
    />
  );
}

function PasswordField({ placeholder, value, onChange, show, onToggle, onFocus }: {
  placeholder: string; value: string; onChange: (v: string) => void;
  show: boolean; onToggle: () => void; onFocus?: () => void;
}) {
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'} placeholder={placeholder} value={value} required
        onChange={e => onChange(e.target.value)}
        onFocus={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.55)'; e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.06)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; onFocus?.(); }}
        onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.boxShadow = 'none'; }}
        className="w-full px-4 pr-12 rounded-xl text-base outline-none transition-all"
        style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: '#fff', height: '50px', fontSize: '16px' }}
      />
      <button type="button" onClick={onToggle} tabIndex={-1}
        className="absolute right-0 top-0 h-full px-4 flex items-center justify-center rounded-r-xl transition-opacity hover:opacity-70"
        style={{ color: 'rgba(255,255,255,0.3)', minWidth: '48px' }}>
        {show ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function SubmitBtn({ loading, label, loadingLabel, disabled }: {
  loading: boolean; label: string; loadingLabel: string; disabled?: boolean;
}) {
  return (
    <button type="submit" disabled={loading || disabled}
      className="submit-btn w-full rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
      style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', boxShadow: '0 4px 20px rgba(99,102,241,0.3)', height: '50px' }}>
      {loading ? <span className="flex items-center justify-center gap-2"><Spinner />{loadingLabel}</span> : label}
    </button>
  );
}

function SocialGrid({ providers, loading, disabled, onLogin }: {
  providers: typeof PROVIDERS; loading: string | null; disabled: boolean;
  onLogin: (id: Provider) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {providers.map(p => (
        <SocialBtnCompact key={p.id} provider={p} loading={loading === p.id} disabled={disabled} onClick={() => onLogin(p.id)} />
      ))}
    </div>
  );
}

function SocialBtnCompact({ provider, loading, disabled, onClick }: {
  provider: typeof PROVIDERS[number]; loading: boolean; disabled: boolean; onClick: () => void;
}) {
  const { label, icon: Icon } = provider;
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="social-btn w-full flex items-center justify-center gap-3 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
      style={{ backgroundColor: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.85)', height: '50px' }}>
      {loading ? <Spinner /> : <><Icon className="w-[18px] h-[18px] shrink-0" /><span>Continue with {label}</span></>}
    </button>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
      <span className="text-xs whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.25)' }}>{label}</span>
      <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
    </div>
  );
}

function Alert({ type, msg, children }: { type: 'error' | 'success'; msg: string; children?: React.ReactNode }) {
  return (
    <div className="px-3.5 py-2.5 rounded-xl text-xs leading-relaxed flex items-start gap-2"
      style={{
        backgroundColor: type === 'error' ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
        color: type === 'error' ? '#f87171' : '#4ade80',
        border: `1px solid ${type === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
      }}>
      <span className="shrink-0 mt-0.5">{type === 'error' ? '⚠' : '✓'}</span>
      <span>{msg}{children}</span>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
      <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
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

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  );
}
