/**
 * Purpose: Presents account registration and transitions a new authenticated user into chat.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight } from 'lucide-react';

import AuthShell from '../components/AuthShell';
import { useAuth } from '../context/AuthContext';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Renders the registration form and creates a user account.
 *
 * @returns {JSX.Element} Registration page.
 */
const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [formValues, setFormValues] = useState({
    confirmPassword: '',
    email: '',
    password: '',
    username: ''
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Updates one registration field.
   *
   * @param {import('react').ChangeEvent<HTMLInputElement>} event - Changed input.
   * @returns {void}
   */
  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormValues((currentValues) => ({ ...currentValues, [name]: value }));
  };

  /**
   * Validates and submits new account input.
   *
   * @param {import('react').FormEvent<HTMLFormElement>} event - Submit event.
   * @returns {Promise<void>} Resolves after registration attempt.
   */
  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (formValues.password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (formValues.password !== formValues.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      await register({
        email: formValues.email.trim(),
        password: formValues.password,
        username: formValues.username.trim()
      });
      navigate('/chat', { replace: true });
    } catch (submissionError) {
      setError(submissionError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell heading="Create account" subheading="Join the conversation.">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="mb-2 block text-sm font-medium text-muted" htmlFor="username">
            Username
          </label>
          <input
            autoComplete="username"
            className="field"
            id="username"
            maxLength={30}
            minLength={3}
            name="username"
            onChange={handleChange}
            pattern="[A-Za-z0-9_-]+"
            placeholder="shriya"
            required
            value={formValues.username}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-muted" htmlFor="register-email">
            Email
          </label>
          <input
            autoComplete="email"
            className="field"
            id="register-email"
            name="email"
            onChange={handleChange}
            placeholder="you@example.com"
            required
            type="email"
            value={formValues.email}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-muted" htmlFor="register-password">
            Password
          </label>
          <input
            autoComplete="new-password"
            className="field"
            id="register-password"
            minLength={MIN_PASSWORD_LENGTH}
            name="password"
            onChange={handleChange}
            required
            type="password"
            value={formValues.password}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-muted" htmlFor="confirm-password">
            Confirm password
          </label>
          <input
            autoComplete="new-password"
            className="field"
            id="confirm-password"
            minLength={MIN_PASSWORD_LENGTH}
            name="confirmPassword"
            onChange={handleChange}
            required
            type="password"
            value={formValues.confirmPassword}
          />
        </div>

        {error && (
          <p className="flex items-center gap-2 text-sm text-coral" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        <button className="primary-button mt-2 w-full" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Creating account...' : 'Create account'}
          {!isSubmitting && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>
      <p className="mt-7 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link className="font-medium text-accent transition hover:text-accent-hover" to="/login">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
};

export default RegisterPage;
