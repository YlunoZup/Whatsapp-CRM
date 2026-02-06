import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import { authApi } from '@/services/api';
import { Eye, EyeOff } from 'lucide-react';

export function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [tenantName, setTenantName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Password validation helper
  const validatePassword = (pwd: string) => {
    const hasLowercase = /[a-z]/.test(pwd);
    const hasUppercase = /[A-Z]/.test(pwd);
    const hasNumber = /\d/.test(pwd);
    const hasSpecial = /[@$!%*?&]/.test(pwd);
    const hasMinLength = pwd.length >= 8;
    return { hasLowercase, hasUppercase, hasNumber, hasSpecial, hasMinLength };
  };

  const passwordChecks = validatePassword(password);
  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate password requirements
    if (!isPasswordValid) {
      setError('Password does not meet all requirements');
      return;
    }

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const { data } = await authApi.register({ name, email, password, tenantName });
      setAuth(data);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* WhatsApp-style green header bar */}
      <div className="h-56 bg-[#00A884] dark:bg-[#008069]" />

      {/* Register card centered on the page */}
      <div className="flex-1 flex items-start justify-center -mt-32 px-4 pb-8">
        <div className="w-full max-w-md bg-card rounded-lg shadow-xl border border-border overflow-hidden">
          {/* Card header with logo */}
          <div className="p-6 pb-4 text-center">
            <div className="flex justify-center mb-3">
              <div className="w-16 h-16 bg-[#00A884] dark:bg-[#00A884] rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-semibold text-foreground">WhatsApp CRM</h1>
            <p className="text-[#667781] dark:text-[#8696A0] mt-1 text-sm">
              Create your account to get started
            </p>
          </div>

          {/* Register form */}
          <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-[#41525D] dark:text-[#D1D7DB] mb-1.5">
                Your Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 border border-[#D1D7DB] dark:border-[#3B4A54] rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#00A884] focus:border-transparent transition-shadow"
                placeholder="Enter your full name"
                required
              />
            </div>

            <div>
              <label htmlFor="tenantName" className="block text-sm font-medium text-[#41525D] dark:text-[#D1D7DB] mb-1.5">
                Company Name
              </label>
              <input
                id="tenantName"
                type="text"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                className="w-full px-4 py-2.5 border border-[#D1D7DB] dark:border-[#3B4A54] rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#00A884] focus:border-transparent transition-shadow"
                placeholder="Enter your company name"
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#41525D] dark:text-[#D1D7DB] mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-[#D1D7DB] dark:border-[#3B4A54] rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#00A884] focus:border-transparent transition-shadow"
                placeholder="Enter your email"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#41525D] dark:text-[#D1D7DB] mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 pr-12 border border-[#D1D7DB] dark:border-[#3B4A54] rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#00A884] focus:border-transparent transition-shadow"
                  placeholder="Create a password"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[#667781] hover:text-[#41525D] dark:text-[#8696A0] dark:hover:text-[#D1D7DB] transition-colors rounded-lg hover:bg-[#F0F2F5] dark:hover:bg-[#2A3942]"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              <div className="mt-2 space-y-1">
                <p className="text-xs text-[#667781] dark:text-[#8696A0] font-medium">Password requirements:</p>
                <ul className="text-xs space-y-0.5">
                  <li className={passwordChecks.hasMinLength ? 'text-green-600 dark:text-green-400' : 'text-[#667781] dark:text-[#8696A0]'}>
                    {passwordChecks.hasMinLength ? '\u2713' : '\u2022'} At least 8 characters
                  </li>
                  <li className={passwordChecks.hasUppercase ? 'text-green-600 dark:text-green-400' : 'text-[#667781] dark:text-[#8696A0]'}>
                    {passwordChecks.hasUppercase ? '\u2713' : '\u2022'} One uppercase letter (A-Z)
                  </li>
                  <li className={passwordChecks.hasLowercase ? 'text-green-600 dark:text-green-400' : 'text-[#667781] dark:text-[#8696A0]'}>
                    {passwordChecks.hasLowercase ? '\u2713' : '\u2022'} One lowercase letter (a-z)
                  </li>
                  <li className={passwordChecks.hasNumber ? 'text-green-600 dark:text-green-400' : 'text-[#667781] dark:text-[#8696A0]'}>
                    {passwordChecks.hasNumber ? '\u2713' : '\u2022'} One number (0-9)
                  </li>
                  <li className={passwordChecks.hasSpecial ? 'text-green-600 dark:text-green-400' : 'text-[#667781] dark:text-[#8696A0]'}>
                    {passwordChecks.hasSpecial ? '\u2713' : '\u2022'} One special character (@$!%*?&)
                  </li>
                </ul>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#41525D] dark:text-[#D1D7DB] mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 pr-12 border border-[#D1D7DB] dark:border-[#3B4A54] rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#00A884] focus:border-transparent transition-shadow"
                  placeholder="Confirm your password"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[#667781] hover:text-[#41525D] dark:text-[#8696A0] dark:hover:text-[#D1D7DB] transition-colors rounded-lg hover:bg-[#F0F2F5] dark:hover:bg-[#2A3942]"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-[#00A884] hover:bg-[#008069] text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Footer link */}
          <div className="px-6 pb-6 text-center">
            <p className="text-sm text-[#667781] dark:text-[#8696A0]">
              Already have an account?{' '}
              <Link to="/login" className="text-[#00A884] hover:text-[#008069] font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
