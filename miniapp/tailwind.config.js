/**
 * Enhanced Tailwind Config - Premium Design System
 * @type {import('tailwindcss').Config}
 */

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      // ====================================================================
      // COLORS - Premium Color Palette
      // ====================================================================
      colors: {
        brand: '#f8812d',
        // Semantic colors with depth
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#145231',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        info: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        pending: '#f59e0b',
        processing: '#3b82f6',
        completed: '#10b981',
        declined: '#ef4444',
      },

      // ====================================================================
      // SPACING - Premium Spacing Scale
      // ====================================================================
      spacing: {
        '13': '3.25rem',
        '15': '3.75rem',
        '17': '4.25rem',
        '18': '4.5rem',
        '20': '5rem',
      },

      // ====================================================================
      // BORDER RADIUS - Premium Rounded Corners
      // ====================================================================
      borderRadius: {
        'xs-round': '12px',
        'sm-round': '16px',
        'md-round': '20px',
        'lg-round': '24px',
        'xl-plus': '28px',
        '4xl': '32px',
        '5xl': '40px',
      },

      // ====================================================================
      // BOX SHADOWS - Premium Shadow Hierarchy
      // ====================================================================
      boxShadow: {
        // Subtle shadows for depth
        'xs-glass': '0 2px 8px rgba(0, 0, 0, 0.04)',
        'sm-glass': '0 4px 12px rgba(0, 0, 0, 0.06)',
        'md-glass': '0 8px 24px rgba(0, 0, 0, 0.08)',
        'lg-glass': '0 16px 40px rgba(0, 0, 0, 0.1)',
        'xl-glass': '0 24px 60px rgba(0, 0, 0, 0.12)',
        
        // Premium elevation
        'float': '0 20px 60px rgba(15, 23, 42, 0.06)',
        'elevated': '0 32px 100px rgba(15, 23, 42, 0.18)',
        'floating': '0 40px 120px rgba(15, 23, 42, 0.2)',

        // Interactive states
        'inset-light': 'inset 0 2px 4px rgba(255, 255, 255, 0.5)',
        'inset-dark': 'inset 0 2px 4px rgba(0, 0, 0, 0.1)',
      },

      // ====================================================================
      // ANIMATIONS - Smooth, Purposeful Motion
      // ====================================================================
      animation: {
        'slide-up': 'slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'slide-down': 'slideDown 0.4s ease-out',
        'slide-in-left': 'slideInLeft 0.4s ease-out',
        'slide-in-right': 'slideInRight 0.4s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'fade-out': 'fadeOut 0.3s ease-out',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'pulse-subtle': 'pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s infinite',
        'bounce-subtle': 'bounceSubtle 0.6s ease-in-out',
        'spin-slow': 'spin 3s linear infinite',
        'ping-soft': 'pingSoft 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      },

      // ====================================================================
      // KEYFRAMES - Animation Definitions
      // ====================================================================
      keyframes: {
        slideUp: {
          'from': { transform: 'translateY(8px)', opacity: '0' },
          'to': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          'from': { transform: 'translateY(-8px)', opacity: '0' },
          'to': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInLeft: {
          'from': { transform: 'translateX(-16px)', opacity: '0' },
          'to': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInRight: {
          'from': { transform: 'translateX(16px)', opacity: '0' },
          'to': { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          'from': { opacity: '0' },
          'to': { opacity: '1' },
        },
        fadeOut: {
          'from': { opacity: '1' },
          'to': { opacity: '0' },
        },
        scaleIn: {
          'from': { transform: 'scale(0.95)', opacity: '0' },
          'to': { transform: 'scale(1)', opacity: '1' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '.7' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(248, 129, 45, 0.7)' },
          '50%': { boxShadow: '0 0 0 8px rgba(248, 129, 45, 0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        pingSoft: {
          '75%, 100%': {
            transform: 'scale(2)',
            opacity: '0',
          },
        },
      },

      // ====================================================================
      // FONT FAMILY - Premium Typography
      // ====================================================================
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['Poppins', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
      },

      // ====================================================================
      // FONT SIZE - Extended Scale
      // ====================================================================
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1.2' }],
        '6xl': ['3.75rem', { lineHeight: '1.2' }],
        '7xl': ['4.5rem', { lineHeight: '1.2' }],
      },

      // ====================================================================
      // FONT WEIGHT - Typography Hierarchy
      // ====================================================================
      fontWeight: {
        thin: '100',
        extralight: '200',
        light: '300',
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        extrabold: '800',
        black: '900',
      },

      // ====================================================================
      // TRANSITIONS & DURATIONS
      // ====================================================================
      transitionDuration: {
        '0': '0ms',
        '50': '50ms',
        '100': '100ms',
        '150': '150ms',
        '200': '200ms',
        '300': '300ms',
        '400': '400ms',
        '500': '500ms',
      },

      // ====================================================================
      // OPACITY - Subtle Variations
      // ====================================================================
      opacity: {
        '0': '0',
        '5': '0.05',
        '10': '0.1',
        '20': '0.2',
        '30': '0.3',
        '40': '0.4',
        '50': '0.5',
        '60': '0.6',
        '70': '0.7',
        '80': '0.8',
        '90': '0.9',
        '95': '0.95',
        '100': '1',
      },

      // ====================================================================
      // BACKDROP BLUR - Glassmorphism
      // ====================================================================
      backdropBlur: {
        'xs': '2px',
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '20px',
        '2xl': '40px',
      },

      // ====================================================================
      // GRADIENT - Premium Gradients
      // ====================================================================
      backgroundImage: {
        'gradient-premium': 'linear-gradient(135deg, #f8812d 0%, #ff6b35 100%)',
        'gradient-success': 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        'gradient-warning': 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        'gradient-error': 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
        'gradient-subtle': 'linear-gradient(135deg, rgba(248, 129, 45, 0.05) 0%, rgba(255, 107, 53, 0.02) 100%)',
      },

      // ====================================================================
      // Z-INDEX - Stacking Hierarchy
      // ====================================================================
      zIndex: {
        '0': '0',
        '10': '10',
        '20': '20',
        '30': '30',
        '40': '40',
        '50': '50',
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
        'dropdown': '1000',
        'sticky': '1020',
        'modal-backdrop': '1040',
        'modal': '1050',
        'popover': '1060',
        'tooltip': '1070',
      },
    },
  },

  plugins: [
    // Custom utilities plugin for premium features
    function ({ addComponents, addUtilities, theme }) {
      // Card component
      addComponents({
        '.card': {
          '@apply rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm-glass': {},
        },
        '.card-elevated': {
          '@apply rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-float': {},
        },
        '.card-glass': {
          '@apply rounded-2xl backdrop-blur-md bg-white/70 dark:bg-slate-900/40 border border-white/20 dark:border-white/10 shadow-lg-glass': {},
        },
      });

      // Glass effect utilities
      addUtilities({
        '.glass': {
          '@apply backdrop-blur-md bg-white/70 dark:bg-slate-900/40 border border-white/20 dark:border-white/10': {},
        },
        '.glass-sm': {
          '@apply backdrop-blur-sm bg-white/50 dark:bg-slate-900/30': {},
        },
        '.text-ellipsis-2': {
          overflow: 'hidden',
          display: '-webkit-box',
          '-webkit-line-clamp': '2',
          '-webkit-box-orient': 'vertical',
        },
        '.text-ellipsis-3': {
          overflow: 'hidden',
          display: '-webkit-box',
          '-webkit-line-clamp': '3',
          '-webkit-box-orient': 'vertical',
        },
      });
    },
  ],
}
