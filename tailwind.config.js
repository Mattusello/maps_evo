/** @type {import('tailwindcss').Config} */
// I nomi colore mappano le variabili CSS di `src/global.css` (che risolvono light/dark).
// La sintassi `rgb(var(--x) / <alpha-value>)` abilita l'opacità (es. bg-primary/10).
const withVar = (name) => `rgb(var(${name}) / <alpha-value>)`;

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: withVar('--color-background'),
        surface: withVar('--color-surface'),
        'surface-muted': withVar('--color-surface-muted'),
        border: withVar('--color-border'),

        text: withVar('--color-text'),
        'text-secondary': withVar('--color-text-secondary'),
        'text-tertiary': withVar('--color-text-tertiary'),

        primary: withVar('--color-primary'),
        'on-primary': withVar('--color-on-primary'),
        'primary-container': withVar('--color-primary-container'),
        'on-primary-container': withVar('--color-on-primary-container'),

        success: withVar('--color-success'),
        'success-container': withVar('--color-success-container'),
        warning: withVar('--color-warning'),
        'warning-container': withVar('--color-warning-container'),
        danger: withVar('--color-danger'),
        'danger-container': withVar('--color-danger-container'),
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '28px',
        pill: '999px',
      },
      fontFamily: {
        display: ['Archivo_700Bold'],
        'display-semibold': ['Archivo_600SemiBold'],
        'display-extrabold': ['Archivo_800ExtraBold'],
      },
    },
  },
  plugins: [],
};
