/**
 * Purpose: Presents credential login and transitions authenticated users into chat.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight } from 'lucide-react';

import AuthShell from '../components/AuthShell';
import { useAuth } from '../context/AuthContext';

/**
 * Renders the login form and submits credentials to authentication context.
 *
 * @returns {JSX.Element} Login page.
 */
const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [formValues, setFormValues] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Updates one form field.
   *
   * @param {import('react').ChangeEvent<HTMLInputElement>} event - Changed input.
   * @returns {void}
   */
  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormValues((currentValues) => ({ ...currentValues, [name]: value }));
  };

  /**
   * Authenticates the submitted credentials.
   *
   * @param {import('react').FormEvent<HTMLFormElement>} event - Submit event.
   * @returns {Promise<void>} Resolves after authentication attempt.
   */
  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login({
        email: formValues.email.trim(),
        password: formValues.password
      });
      navigate('/chat', { replace: true });
    } catch (submissionError) {
      setError(submissionError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell heading="Welcome back" subheading="Sign in to your workspace.">
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div>
          <label className="mb-2 block text-sm font-medium text-muted" htmlFor="email">
            Email
          </label>
          <input
            autoComplete="email"
            className="field"
            id="email"
            name="email"
            onChange={handleChange}
            placeholder="you@example.com"
            required
            type="email"
            value={formValues.email}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-muted" htmlFor="password">
            Password
          </label>
          <input
            autoComplete="current-password"
            className="field"
            id="password"
            minLength={8}
            name="password"
            onChange={handleChange}
            required
            type="password"
            value={formValues.password}
          />
        </div>

        {error && (
          <p className="flex items-center gap-2 text-sm text-coral" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        <button className="primary-button w-full" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Signing in...' : 'Sign in'}
          {!isSubmitting && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>
      <p className="mt-7 text-center text-sm text-muted">
        New to ChatterBox?{' '}
        <Link className="font-medium text-accent transition hover:text-accent-hover" to="/register">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
};

export default LoginPage;
