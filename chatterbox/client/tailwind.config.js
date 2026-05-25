/**
 * Purpose: TailwindCSS source scanning and palette configuration for the ChatterBox interface.
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#0e141d',
        panel: '#151d28',
        raised: '#1b2633',
        stroke: '#293645',
        ink: '#eef3f7',
        muted: '#9baabd',
        accent: '#24b8a6',
        'accent-hover': '#1d9b8d',
        coral: '#f37d68'
      },
      boxShadow: {
        modal: '0 18px 50px rgba(0, 0, 0, 0.42)'
      }
    }
  },
  plugins: []
};
