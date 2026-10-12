import React, { useState } from 'react';
import { BrandLogo } from './BrandLogo';
import { Eye, EyeOff, Lock, User, Mail, ShieldCheck, CheckCircle2, AlertCircle, Sparkles, KeyRound } from 'lucide-react';
import { apiRequest, setStoredToken } from '../lib/api';
import type { UserProfile } from '../types';

interface AuthModalProps {
  onSuccess: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'recover'>('register');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Login identifier (username or email)
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Recovery fields
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [generatedRecoveryCode, setGeneratedRecoveryCode] = useState<string | null>(null);

  // Live password validation checklist
  const isExactEightChars = password.length === 8;
  const hasAlphabet = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isPasswordValid = isExactEightChars && hasAlphabet && hasNumber;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!fullName.trim()) {
      setErrorMessage('Full real name is required.');
      return;
    }
    if (!username.trim() || username.trim().length < 3) {
      setErrorMessage('Username must be at least 3 characters.');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
      setErrorMessage('Username can only contain letters, numbers, and underscores.');
      return;
    }
    if (!isPasswordValid) {
      setErrorMessage('Password must be exactly 8 characters with at least 1 letter and 1 number.');
      return;
    }
    if (!passwordsMatch) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const data = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName: fullName.trim(),
          username: username.trim(),
          email: email.trim() || null,
          password
        })
      });

      setStoredToken(data.token);
      setGeneratedRecoveryCode(data.user.recoveryCode || null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!loginIdentifier.trim() || !loginPassword) {
      setErrorMessage('Please enter your username/email and password.');
      return;
    }

    setLoading(true);
    try {
      const data = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: loginIdentifier.trim(),
          password: loginPassword
        })
      });

      setStoredToken(data.token);
      onSuccess(data.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!loginIdentifier.trim() || !recoveryCode.trim() || !newPassword) {
      setErrorMessage('All fields are required.');
      return;
    }
    if (newPassword.length !== 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setErrorMessage('New password must be exactly 8 characters with at least 1 letter and 1 number.');
      return;
    }

    setLoading(true);
    try {
      const data = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/recover', {
        method: 'POST',
        body: JSON.stringify({
          identifier: loginIdentifier.trim(),
          recoveryCode: recoveryCode.trim(),
          newPassword
        })
      });

      setStoredToken(data.token);
      onSuccess(data.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Password recovery failed');
    } finally {
      setLoading(false);
    }
  };

  // Quick login helper for demo accounts
  const quickDemoLogin = async (usernameTarget: string, pass: string) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: usernameTarget,
          password: pass
        })
      });
      setStoredToken(data.token);
      onSuccess(data.user);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-md bg-white/95 rounded-3xl shadow-2xl border border-[#E5E5EA] p-6 sm:p-8 text-[#1C1C1E] transition-all">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-6">
          <BrandLogo size="md" />
          <p className="text-xs text-[#8E8E93] mt-2 font-medium tracking-wide">
            PURE REFINEMENT IN MESSAGING
          </p>
        </div>

        {/* Post-Registration Recovery Code Display Screen */}
        {generatedRecoveryCode ? (
          <div className="space-y-5 py-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-semibold text-[#1C1C1E]">Account Created!</h3>
              <p className="text-xs text-[#636366]">
                Here is your secret Account Recovery Code. Store it safely to recover your account if you ever forget your password.
              </p>
            </div>

            <div className="bg-[#F2F2F7] border border-[#D1D1D6] rounded-2xl p-4 text-center select-all">
              <p className="text-xs font-medium text-[#8E8E93] uppercase tracking-wider mb-1">Recovery Code</p>
              <p className="text-lg font-mono font-bold tracking-widest text-[#1C1C1E]">
                {generatedRecoveryCode}
              </p>
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(generatedRecoveryCode);
                setSuccessNotice('Recovery code copied to clipboard!');
                setTimeout(() => {
                  window.location.reload();
                }, 1000);
              }}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#1C1C1E] text-white font-medium text-sm hover:bg-[#2C2C2E] transition shadow-sm"
            >
              Copy Code & Enter LAMAVI
            </button>
            {successNotice && (
              <p className="text-xs text-center text-emerald-600 font-medium">{successNotice}</p>
            )}
          </div>
        ) : (
          <>
            {/* Mode Switch Tabs */}
            <div className="grid grid-cols-2 p-1 bg-[#F2F2F7] rounded-xl mb-6 text-sm font-medium">
              <button
                type="button"
                onClick={() => { setMode('register'); setErrorMessage(null); }}
                className={`py-2 rounded-lg transition ${
                  mode === 'register' 
                    ? 'bg-white shadow-xs text-[#1C1C1E]' 
                    : 'text-[#8E8E93] hover:text-[#1C1C1E]'
                }`}
              >
                Create Account
              </button>
              <button
                type="button"
                onClick={() => { setMode('login'); setErrorMessage(null); }}
                className={`py-2 rounded-lg transition ${
                  mode === 'login' || mode === 'recover'
                    ? 'bg-white shadow-xs text-[#1C1C1E]' 
                    : 'text-[#8E8E93] hover:text-[#1C1C1E]'
                }`}
              >
                Log In
              </button>
            </div>

            {/* Error Message Alert */}
            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* REGISTER FORM */}
            {mode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#636366] uppercase tracking-wider mb-1.5">
                    Full Real Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-3.5 text-[#AEAEB2]" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Christian Dior"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F8F9FA] border border-[#E5E5EA] text-sm focus:outline-none focus:border-[#8E8E93] focus:bg-white transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#636366] uppercase tracking-wider mb-1.5">
                    Unique Username <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-sm text-[#AEAEB2] font-mono">@</span>
                    <input
                      type="text"
                      required
                      placeholder="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#F8F9FA] border border-[#E5E5EA] text-sm focus:outline-none focus:border-[#8E8E93] focus:bg-white transition"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-[#636366] uppercase tracking-wider">
                      Email Address
                    </label>
                    <span className="text-[11px] text-[#8E8E93] font-normal">Optional</span>
                  </div>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-[#AEAEB2]" />
                    <input
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F8F9FA] border border-[#E5E5EA] text-sm focus:outline-none focus:border-[#8E8E93] focus:bg-white transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#636366] uppercase tracking-wider mb-1.5">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-[#AEAEB2]" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      maxLength={8}
                      placeholder="Exactly 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#F8F9FA] border border-[#E5E5EA] text-sm focus:outline-none focus:border-[#8E8E93] focus:bg-white transition font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-[#8E8E93] hover:text-[#1C1C1E]"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Requirements checklist */}
                  <div className="mt-2 grid grid-cols-3 gap-1 text-[11px]">
                    <div className={`flex items-center gap-1 ${isExactEightChars ? 'text-emerald-600 font-medium' : 'text-[#8E8E93]'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isExactEightChars ? 'bg-emerald-500' : 'bg-[#D1D1D6]'}`} />
                      8 Chars ({password.length}/8)
                    </div>
                    <div className={`flex items-center gap-1 ${hasAlphabet ? 'text-emerald-600 font-medium' : 'text-[#8E8E93]'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${hasAlphabet ? 'bg-emerald-500' : 'bg-[#D1D1D6]'}`} />
                      At least 1 Letter
                    </div>
                    <div className={`flex items-center gap-1 ${hasNumber ? 'text-emerald-600 font-medium' : 'text-[#8E8E93]'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${hasNumber ? 'bg-emerald-500' : 'bg-[#D1D1D6]'}`} />
                      At least 1 Digit
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#636366] uppercase tracking-wider mb-1.5">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-[#AEAEB2]" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      maxLength={8}
                      placeholder="Repeat password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#F8F9FA] border border-[#E5E5EA] text-sm focus:outline-none focus:border-[#8E8E93] focus:bg-white transition font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-3 text-[#8E8E93] hover:text-[#1C1C1E]"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && (
                    <p className={`text-[11px] mt-1 ${passwordsMatch ? 'text-emerald-600' : 'text-red-500'}`}>
                      {passwordsMatch ? '✓ Passwords match' : '✕ Passwords do not match'}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !isPasswordValid || !passwordsMatch || !fullName.trim() || !username.trim()}
                  className="w-full mt-2 py-3 rounded-2xl bg-[#1C1C1E] text-white font-medium text-sm hover:bg-[#2C2C2E] disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                </button>

                <p className="text-center text-xs text-[#8E8E93] mt-2">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setErrorMessage(null); }}
                    className="text-[#1C1C1E] font-semibold underline underline-offset-2"
                  >
                    Log In
                  </button>
                </p>
              </form>
            )}

            {/* LOGIN FORM */}
            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#636366] uppercase tracking-wider mb-1.5">
                    Username or Email
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-3.5 text-[#AEAEB2]" />
                    <input
                      type="text"
                      required
                      placeholder="Username or registered email"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F8F9FA] border border-[#E5E5EA] text-sm focus:outline-none focus:border-[#8E8E93] focus:bg-white transition"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-[#636366] uppercase tracking-wider">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => { setMode('recover'); setErrorMessage(null); }}
                      className="text-xs text-[#8E8E93] hover:text-[#1C1C1E]"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-[#AEAEB2]" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Enter 8-character password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#F8F9FA] border border-[#E5E5EA] text-sm focus:outline-none focus:border-[#8E8E93] focus:bg-white transition font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-[#8E8E93] hover:text-[#1C1C1E]"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 rounded-2xl bg-[#1C1C1E] text-white font-medium text-sm hover:bg-[#2C2C2E] disabled:opacity-50 transition shadow-sm"
                >
                  {loading ? 'Logging In...' : 'Log In'}
                </button>

                <p className="text-center text-xs text-[#8E8E93] mt-2">
                  New to LAMAVI?{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('register'); setErrorMessage(null); }}
                    className="text-[#1C1C1E] font-semibold underline underline-offset-2"
                  >
                    Create an Account
                  </button>
                </p>
              </form>
            )}

            {/* RECOVERY FORM */}
            {mode === 'recover' && (
              <form onSubmit={handleRecover} className="space-y-4">
                <div className="text-center mb-2">
                  <h4 className="text-sm font-semibold text-[#1C1C1E]">Account Recovery</h4>
                  <p className="text-xs text-[#8E8E93]">Use your recovery code to set a new password.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#636366] uppercase tracking-wider mb-1">
                    Username or Email
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter your username or email"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F9FA] border border-[#E5E5EA] text-sm focus:outline-none focus:border-[#8E8E93]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#636366] uppercase tracking-wider mb-1">
                    Recovery Code
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="LAMAVI-XXXX-XXXX"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F9FA] border border-[#E5E5EA] text-sm font-mono tracking-wider focus:outline-none focus:border-[#8E8E93]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#636366] uppercase tracking-wider mb-1">
                    New Password (8 characters, letter + number)
                  </label>
                  <input
                    type="password"
                    required
                    maxLength={8}
                    placeholder="New 8-character password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F9FA] border border-[#E5E5EA] text-sm font-mono focus:outline-none focus:border-[#8E8E93]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-2xl bg-[#1C1C1E] text-white font-medium text-sm hover:bg-[#2C2C2E] transition shadow-sm"
                >
                  {loading ? 'Resetting...' : 'Reset Password & Log In'}
                </button>

                <p className="text-center text-xs text-[#8E8E93]">
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setErrorMessage(null); }}
                    className="text-[#1C1C1E] underline"
                  >
                    Back to Log In
                  </button>
                </p>
              </form>
            )}

            {/* Quick Demo Test Helper */}
            <div className="mt-6 pt-5 border-t border-[#E5E5EA]/80">
              <p className="text-[11px] text-[#8E8E93] text-center mb-2 font-medium">
                ⚡ TEST ACCOUNTS (1-CLICK LOG IN):
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => quickDemoLogin('sophia_vance', 'Pass1234')}
                  className="py-2 px-3 rounded-xl bg-[#F2F2F7] hover:bg-[#E5E5EA] text-xs font-medium text-[#1C1C1E] flex items-center justify-center gap-1.5 transition"
                >
                  <span>Sophia Vance</span>
                  <span className="text-[10px] text-[#8E8E93]">(@sophia)</span>
                </button>
                <button
                  type="button"
                  onClick={() => quickDemoLogin('julian_silver', 'Silver01')}
                  className="py-2 px-3 rounded-xl bg-[#F2F2F7] hover:bg-[#E5E5EA] text-xs font-medium text-[#1C1C1E] flex items-center justify-center gap-1.5 transition"
                >
                  <span>Julian Sterling</span>
                  <span className="text-[10px] text-[#8E8E93]">(@julian)</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
