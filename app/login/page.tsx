'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import type { Session } from '@supabase/supabase-js';

const PROVIDERS = [
  { id: 'google',        label: 'Google',   icon: GoogleIcon },
  { id: 'github',        label: 'GitHub',   icon: GitHubIcon },
  { id: 'facebook',      label: 'Facebook', icon: FacebookIcon },
  { id: 'linkedin_oidc', label: 'LinkedIn', icon: LinkedInIcon },
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
  { id: 'len',     label: 'At least 8 characters',      test: (p: string) => p.length >= 8 },
  { id: 'upper',   label: 'One uppercase letter (A–Z)',  test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lower',   label: 'One lowercase letter (a–z)',  test: (p: string) => /[a-z]/.test(p) },
  { id: 'number',  label: 'One number (0–9)',            test: (p: string) => /[0-9]/.test(p) },
  { id: 'special', label: 'One special character (!@#$)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  const passed = PW_RULES.filter(r => r.test(pw)).length;
  // bonus point for length ≥ 12
  const score = Math.min(5, passed + (pw.length >= 12 ? 1 : 0));
  if (score <= 1) return { score, label: 'Weak',   color: '#ef4444' };
  if (score <= 3) return { score, label: 'Fair',   color: '#f59e0b' };
  if (score === 4) return { score, label: 'Good',  color: '#3b82f6' };
  return              { score, label: 'Strong', color: '#22c55e' };
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = getSupabaseBrowser();
  const [screen, setScreen]             = useState<Screen>(
    searchParams.get('screen') === 'forgot' ? 'forgot' : 'login'
  );
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [name, setName]                 = useState('');
  const [showPw, setShowPw]             = useState(false);
  const [loading, setLoading]           = useState<string | null>(null);
  const [error, setError]               = useState<string | null>(null);
  const [errorAction, setErrorAction]   = useState<{ label: string; screen: Screen } | null>(null);
  const [success, setSuccess]           = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [pwFocused, setPwFocused]       = useState(false);

  const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? '';

  useEffect(() => {
    supabase.auth.getSession().then((res: { data: { session: Session | null } }) => {
      const s = res.data.session;
      if (s) router.replace(ADMIN_EMAIL && s.user.email === ADMIN_EMAIL ? '/admin' : '/');
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      if (session) router.replace(ADMIN_EMAIL && session.user.email === ADMIN_EMAIL ? '/admin' : '/');
    });
    return () => subscription.unsubscribe();
  }, []);

  function resetMessages() { setError(null); setErrorAction(null); setSuccess(null); }
  function go(s: Screen) { setScreen(s); resetMessages(); setShowPw(false); setPwFocused(false); }

  function setErr(msg: string, action?: { label: string; screen: Screen }) {
    setError(msg);
    setErrorAction(action ?? null);
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
          ? `${provider.replace('_oidc', '')} login isn't enabled yet.`
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
        setErr("No account found for this email.", { label: 'Sign up free', screen: 'signup' });
        setLoading(null);
        return;
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setErr('Incorrect password. Please check and try again.');
        setLoading(null);
        return;
      }
      if (data.session) router.replace(ADMIN_EMAIL && data.session.user.email === ADMIN_EMAIL ? '/admin' : '/');
    } catch {
      setErr('Could not sign in. Please check your connection and try again.');
      setLoading(null);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    resetMessages();
    if (!name.trim()) { setErr('Please enter your full name.'); return; }
    const failedRules = PW_RULES.filter(r => !r.test(password));
    if (failedRules.length) {
      // This shouldn't normally trigger since the inline checklist guides them,
      // but guard against form submission bypasses
      setErr(`Password must meet all requirements below.`);
      setPwFocused(true);
      return;
    }
    setLoading('submit');
    try {
      const exists = await checkEmail(email);
      if (exists) {
        setErr('An account with this email already exists.', { label: 'Sign in instead', screen: 'login' });
        setLoading(null);
        return;
      }
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: name.trim() }, emailRedirectTo: `${location.origin}/auth/callback` },
      });
      if (error) {
        setErr(error.message);
      } else {
        setScreen('verify');
        startResendCooldown();
      }
    } catch {
      setErr('Could not create your account. Please check your connection and try again.');
    }
    setLoading(null);
  }

  function startResendCooldown() {
    setResendCooldown(60);
    const t = setInterval(() => {
      setResendCooldown(n => {
        if (n <= 1) { clearInterval(t); return 0; }
        return n - 1;
      });
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
    e.preventDefault();
    setLoading('submit'); resetMessages();
    try {
      const exists = await checkEmail(email);
      if (!exists) {
        setErr("No account found for this email.", { label: 'Create an account', screen: 'signup' });
        setLoading(null);
        return;
      }
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${location.origin}/reset-password`,
      });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('rate limit') || msg.includes('too many') || msg.includes('exceeded')) {
          setErr('Too many reset emails sent. Please wait a few minutes before trying again.');
        } else {
          setErr(error.message);
        }
        setLoading(null);
        return;
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
    <div className="min-h-screen flex" style={{ backgroundColor: '#0f0f11' }}>
      {/* ── Left panel — branding ── */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)' }}>
        <div className="absolute top-[-80px] right-[-80px] w-[360px] h-[360px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />
        <div className="absolute bottom-[-60px] left-[-60px] w-[280px] h-[280px] rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)' }} />
        <div className="absolute top-1/2 left-1/4 w-[200px] h-[200px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #06b6d4, transparent)' }} />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-lg"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              💰
            </div>
            <span className="text-white text-xl font-bold tracking-tight">FinTrack</span>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <div>
            <h2 className="text-4xl font-bold text-white leading-tight mb-3">
              Take control of<br />
              <span style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                your finances
              </span>
            </h2>
            <p className="text-lg" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Track every rupee, spot trends, and hit your savings goals.
            </p>
          </div>
          <div className="space-y-3">
            {FEATURES.map(f => (
              <div key={f.text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                  style={{ backgroundColor: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)' }}>
                  {f.icon}
                </div>
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 rounded-2xl p-5"
          style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)' }}>
          <p className="text-sm italic mb-3" style={{ color: 'rgba(255,255,255,0.7)' }}>
            &ldquo;Finally, a finance app that doesn&rsquo;t feel like a spreadsheet.&rdquo;
          </p>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              M
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Mayank S.</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Saved ₹40k in 3 months</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel — auth form ── */}
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

          {/* ── Email verification ── */}
          {screen === 'verify' && (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))', border: '1px solid rgba(99,102,241,0.3)' }}>
                  <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="url(#emailGrad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <defs>
                      <linearGradient id="emailGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white mb-2">Check your inbox</h1>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  We sent a confirmation link to
                </p>
                <p className="text-sm font-semibold mt-1" style={{ color: 'rgba(255,255,255,0.85)' }}>{email}</p>
                <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Click it to activate your account. Check spam if you don&apos;t see it.
                </p>
              </div>

              {error   && <Alert type="error"   msg={error} />}
              {success && <Alert type="success" msg={success} />}

              <div className="space-y-3">
                <button type="button" onClick={handleResend}
                  disabled={resendCooldown > 0 || loading === 'resend'}
                  className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 active:scale-[0.98]"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}>
                  {loading === 'resend'
                    ? <span className="flex items-center justify-center gap-2"><Spinner />Resending…</span>
                    : resendCooldown > 0
                      ? `Resend in ${resendCooldown}s`
                      : 'Resend confirmation email'}
                </button>
                <button type="button" onClick={() => go('login')}
                  className="w-full text-sm font-medium transition-opacity hover:opacity-70"
                  style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Back to sign in
                </button>
              </div>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Wrong email?{' '}
                <button type="button" onClick={() => go('signup')} className="underline transition-opacity hover:opacity-70">
                  Sign up again
                </button>
              </p>
            </div>
          )}

          {/* ── Forgot password ── */}
          {screen === 'forgot' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">Reset your password</h1>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Enter your email and we&apos;ll send you a reset link</p>
              </div>
              <form onSubmit={handleForgot} className="space-y-3">
                <InputField type="email" placeholder="Email address" value={email} onChange={setEmail} />
                {error && (
                  <Alert type="error" msg={error}>
                    {errorAction && (
                      <button type="button" onClick={() => go(errorAction.screen)}
                        className="ml-1 font-semibold underline hover:opacity-80">
                        {errorAction.label}
                      </button>
                    )}
                  </Alert>
                )}
                <SubmitBtn loading={isLoading} label="Send reset link" loadingLabel="Checking…" />
              </form>
              <button type="button" onClick={() => go('login')}
                className="flex items-center gap-1 text-sm font-medium transition-opacity hover:opacity-70"
                style={{ color: '#6366f1' }}>
                <span>←</span> Back to sign in
              </button>
            </div>
          )}

          {/* ── Forgot — link sent ── */}
          {screen === 'forgot-sent' && (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))', border: '1px solid rgba(99,102,241,0.3)' }}>
                  <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <defs>
                      <linearGradient id="lockGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                    <rect x="3" y="11" width="18" height="11" rx="2" stroke="url(#lockGrad)" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="url(#lockGrad)" />
                    <circle cx="12" cy="16" r="1.5" fill="#8b5cf6" />
                  </svg>
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white mb-2">Check your inbox</h1>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>We sent a password reset link to</p>
                <p className="text-sm font-semibold mt-1" style={{ color: 'rgba(255,255,255,0.85)' }}>{email}</p>
                <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>The link expires in 1 hour. Check spam if you don&apos;t see it.</p>
              </div>
              <button type="button" onClick={() => go('login')}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] hover:opacity-80"
                style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}>
                Back to sign in
              </button>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Wrong email?{' '}
                <button type="button" onClick={() => go('forgot')} className="underline transition-opacity hover:opacity-70">
                  Try again
                </button>
              </p>
            </div>
          )}

          {/* ── Sign up ── */}
          {screen === 'signup' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">Create your account</h1>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Free forever · no credit card needed</p>
              </div>

              {/* Form first */}
              <form onSubmit={handleSignup} className="space-y-3">
                <InputField type="text"  placeholder="Full name"     value={name}     onChange={setName} />
                <InputField type="email" placeholder="Email address" value={email}    onChange={setEmail} />
                <PasswordField
                  placeholder="Create a password"
                  value={password}
                  onChange={setPassword}
                  show={showPw}
                  onToggle={() => setShowPw(p => !p)}
                  onFocus={() => setPwFocused(true)}
                />

                {/* Live password requirements checklist */}
                {(pwFocused || password.length > 0) && (
                  <div className="rounded-xl px-4 py-3 space-y-2"
                    style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <p className="text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Password requirements</p>
                    {PW_RULES.map(rule => {
                      const ok = rule.test(password);
                      return (
                        <div key={rule.id} className="flex items-center gap-2">
                          <span className="text-xs shrink-0" style={{ color: ok ? '#22c55e' : 'rgba(255,255,255,0.3)' }}>
                            {ok ? '✓' : '○'}
                          </span>
                          <span className="text-xs" style={{ color: ok ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)' }}>
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
                              style={{ backgroundColor: i <= pwStrength.score ? pwStrength.color : 'rgba(255,255,255,0.1)' }} />
                          ))}
                        </div>
                        <p className="text-xs" style={{ color: pwStrength.color }}>{pwStrength.label} password</p>
                      </div>
                    )}
                  </div>
                )}

                {error && (
                  <Alert type="error" msg={error}>
                    {errorAction && (
                      <button type="button" onClick={() => go(errorAction.screen)}
                        className="ml-1 font-semibold underline hover:opacity-80">
                        {errorAction.label}
                      </button>
                    )}
                  </Alert>
                )}
                {success && <Alert type="success" msg={success} />}

                <SubmitBtn
                  loading={isLoading}
                  label="Create account"
                  loadingLabel="Creating account…"
                  disabled={password.length > 0 && !allRulesPassed}
                />
              </form>

              {/* Social divider at bottom */}
              <Divider label="or sign up with" />
              <div className="grid grid-cols-2 gap-2">
                {PROVIDERS.map(p => (
                  <SocialBtnCompact key={p.id} provider={p} loading={loading === p.id} disabled={isLoading}
                    onClick={() => handleSocialLogin(p.id)} />
                ))}
              </div>

              <p className="text-center text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Already have an account?{' '}
                <button type="button" onClick={() => go('login')}
                  className="font-semibold transition-opacity hover:opacity-70" style={{ color: '#6366f1' }}>
                  Sign in
                </button>
              </p>
            </div>
          )}

          {/* ── Login ── */}
          {screen === 'login' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">Welcome back</h1>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Sign in to your FinTrack account</p>
              </div>

              {/* Email/password form first */}
              <form onSubmit={handleLogin} className="space-y-3">
                <InputField type="email" placeholder="Email address" value={email} onChange={setEmail} />
                <div className="space-y-1">
                  <PasswordField placeholder="Password" value={password} onChange={setPassword} show={showPw} onToggle={() => setShowPw(p => !p)} />
                  <div className="flex justify-end">
                    <button type="button" onClick={() => go('forgot')}
                      className="text-xs font-medium transition-opacity hover:opacity-70" style={{ color: '#6366f1' }}>
                      Forgot password?
                    </button>
                  </div>
                </div>
                {error && (
                  <Alert type="error" msg={error}>
                    {errorAction && (
                      <button type="button" onClick={() => go(errorAction.screen)}
                        className="ml-1 font-semibold underline hover:opacity-80">
                        {errorAction.label}
                      </button>
                    )}
                  </Alert>
                )}
                {success && <Alert type="success" msg={success} />}
                <SubmitBtn loading={isLoading} label="Sign in" loadingLabel="Signing in…" />
              </form>

              {/* Social at bottom */}
              <Divider label="or continue with" />
              <div className="grid grid-cols-2 gap-2">
                {PROVIDERS.map(p => (
                  <SocialBtnCompact key={p.id} provider={p} loading={loading === p.id} disabled={isLoading}
                    onClick={() => handleSocialLogin(p.id)} />
                ))}
              </div>

              <p className="text-center text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Don&apos;t have an account?{' '}
                <button type="button" onClick={() => go('signup')}
                  className="font-semibold transition-opacity hover:opacity-70" style={{ color: '#6366f1' }}>
                  Sign up free
                </button>
              </p>
            </div>
          )}

          <p className="text-xs text-center mt-8" style={{ color: 'rgba(255,255,255,0.25)' }}>
            By continuing you agree to our Terms &amp; Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InputField({ type, placeholder, value, onChange }: {
  type: string; placeholder: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <input
      type={type} placeholder={placeholder} value={value} required
      onChange={e => onChange(e.target.value)}
      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
      style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
      onFocus={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)'; e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.07)'; }}
      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
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
        onFocus={e => {
          e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)';
          e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.07)';
          onFocus?.();
        }}
        onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
        className="w-full px-4 py-3 pr-11 rounded-xl text-sm outline-none transition-all"
        style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
      />
      <button type="button" onClick={onToggle} tabIndex={-1}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded transition-opacity hover:opacity-70"
        style={{ color: 'rgba(255,255,255,0.4)' }}>
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
      className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 active:scale-[0.98] hover:opacity-90"
      style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', boxShadow: '0 4px 20px rgba(99,102,241,0.35)' }}>
      {loading ? <span className="flex items-center justify-center gap-2"><Spinner />{loadingLabel}</span> : label}
    </button>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
      <span className="text-xs whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</span>
      <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
    </div>
  );
}

function SocialBtnCompact({ provider, loading, disabled, onClick }: {
  provider: typeof PROVIDERS[number]; loading: boolean; disabled: boolean; onClick: () => void;
}) {
  const { label, icon: Icon } = provider;
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 active:scale-[0.97] hover:opacity-80"
      style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}>
      {loading ? <Spinner /> : <><Icon className="w-4 h-4 shrink-0" /><span>{label}</span></>}
    </button>
  );
}

function Alert({ type, msg, children }: { type: 'error' | 'success'; msg: string; children?: React.ReactNode }) {
  return (
    <div className="px-3 py-2.5 rounded-xl text-xs leading-relaxed"
      style={{
        backgroundColor: type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
        color: type === 'error' ? '#f87171' : '#4ade80',
        border: `1px solid ${type === 'error' ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)'}`,
      }}>
      {msg}{children}
    </div>
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

// ── SVG Icons ─────────────────────────────────────────────────────────────────

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

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  );
}
