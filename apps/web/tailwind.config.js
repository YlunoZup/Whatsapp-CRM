/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      fontFamily: {
        sans: ['Geist', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        whatsapp: {
          DEFAULT: '#22c55e',
          primary: '#22c55e',
          dark: '#16a34a',
          teal: '#14b8a6',
          light: '#dcfce7',
          outgoing: '#dcfce7',
          bg: '#f0fdf4',
          'bg-dark': '#0a0f0d',
          'panel': '#f8fafc',
          'panel-dark': '#0f1419',
          'incoming': '#ffffff',
          'incoming-dark': '#1a1f26',
          'outgoing-dark': '#134e3a',
          'hover': '#f1f5f9',
          'hover-dark': '#1e293b',
          'border': '#e2e8f0',
          'border-dark': '#1e293b',
        },
      },
      borderRadius: {
        '2xl': 'calc(var(--radius) + 4px)',
        xl: 'var(--radius)',
        lg: 'calc(var(--radius) - 2px)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 6px)',
      },
      boxShadow: {
        'glow': '0 0 40px -10px hsl(var(--primary) / 0.3)',
        'glow-sm': '0 0 20px -5px hsl(var(--primary) / 0.2)',
        'premium': '0 1px 2px hsl(var(--foreground) / 0.03), 0 4px 8px hsl(var(--foreground) / 0.04), 0 12px 24px hsl(var(--foreground) / 0.05)',
        'premium-lg': '0 2px 4px hsl(var(--foreground) / 0.02), 0 8px 16px hsl(var(--foreground) / 0.04), 0 24px 48px hsl(var(--foreground) / 0.06)',
        'inner-glow': 'inset 0 1px 0 0 hsl(var(--primary) / 0.1)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-premium': 'linear-gradient(135deg, hsl(var(--primary) / 0.1) 0%, transparent 50%, hsl(var(--primary) / 0.05) 100%)',
        'shimmer': 'linear-gradient(90deg, transparent 0%, hsl(var(--foreground) / 0.03) 50%, transparent 100%)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-down': {
          from: { opacity: '0', transform: 'translateY(-10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(20px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-left': {
          from: { opacity: '0', transform: 'translateX(-20px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'shimmer': {
          from: { backgroundPosition: '-200% 0' },
          to: { backgroundPosition: '200% 0' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px -5px hsl(var(--primary) / 0.3)' },
          '50%': { boxShadow: '0 0 30px -5px hsl(var(--primary) / 0.5)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'fade-up': 'fade-up 0.4s ease-out',
        'fade-down': 'fade-down 0.4s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'slide-in-left': 'slide-in-left 0.3s ease-out',
        'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
      },
      transitionTimingFunction: {
        'premium': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '112': '28rem',
        '128': '32rem',
      },
    },
  },
  plugins: [],
};
