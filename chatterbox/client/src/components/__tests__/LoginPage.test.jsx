/**
 * Purpose: Verifies login page rendering, credential submission, navigation, and authentication errors.
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import LoginPage from '../../pages/LoginPage';
import { useAuth } from '../../context/AuthContext';

const mockNavigate = jest.fn();

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn()
}));

jest.mock('react-router-dom', () => {
  const router = jest.requireActual('react-router-dom');

  return {
    ...router,
    useNavigate: () => mockNavigate
  };
});

/**
 * Renders the login route with browser-router context.
 *
 * @returns {void}
 */
const renderLogin = () => {
  render(
    <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <LoginPage />
    </MemoryRouter>
  );
};

describe('LoginPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    useAuth.mockReturnValue({ login: jest.fn().mockResolvedValue({ id: 'user-1' }) });
  });

  test('renders required credential controls', () => {
    renderLogin();

    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeRequired();
    expect(screen.getByLabelText('Password')).toBeRequired();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  test('submits trimmed credentials and navigates to chat', async () => {
    const login = jest.fn().mockResolvedValue({ id: 'user-1' });
    useAuth.mockReturnValue({ login });
    const user = userEvent.setup();
    renderLogin();

    await act(async () => {
      await user.type(screen.getByLabelText('Email'), 'shriya@example.com ');
      await user.type(screen.getByLabelText('Password'), 'StrongPassword123!');
      await user.click(screen.getByRole('button', { name: /sign in/i }));
    });

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        email: 'shriya@example.com',
        password: 'StrongPassword123!'
      });
      expect(mockNavigate).toHaveBeenCalledWith('/chat', { replace: true });
    });
  });

  test('shows a readable authentication failure', async () => {
    useAuth.mockReturnValue({ login: jest.fn().mockRejectedValue(new Error('Invalid email or password.')) });
    const user = userEvent.setup();
    renderLogin();

    await act(async () => {
      await user.type(screen.getByLabelText('Email'), 'shriya@example.com');
      await user.type(screen.getByLabelText('Password'), 'IncorrectPassword!');
      await user.click(screen.getByRole('button', { name: /sign in/i }));
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
  });
});
