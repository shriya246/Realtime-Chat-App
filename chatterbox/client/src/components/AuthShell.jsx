/**
 * Purpose: Provides a focused branded layout for authentication forms.
 */

import { MessageSquareText } from 'lucide-react';

/**
 * Wraps sign-in and registration content in the authentication screen layout.
 *
 * @param {{ children: import('react').ReactNode, heading: string, subheading: string }} props - Form layout content.
 * @returns {JSX.Element} Authentication layout.
 */
const AuthShell = ({ children, heading, subheading }) => (
  <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-8">
    <section className="w-full max-w-md rounded-md border border-stroke bg-panel p-6 shadow-modal sm:p-8">
      <header className="mb-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-accent text-canvas">
            <MessageSquareText className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold text-ink">ChatterBox</h1>
        </div>
        <h2 className="text-2xl font-semibold text-ink">{heading}</h2>
        <p className="mt-2 text-sm text-muted">{subheading}</p>
      </header>
      {children}
    </section>
  </main>
);

export default AuthShell;
