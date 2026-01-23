/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Microsoft Fluent UI colors
        'ms-blue': {
          50: '#f0f6ff',
          100: '#e0edff',
          500: '#0078d4',
          600: '#106ebe',
          700: '#005a9e',
          800: '#004578',
          900: '#003966'
        },
        'ms-gray': {
          50: '#faf9f8',
          100: '#f3f2f1',
          200: '#edebe9',
          300: '#e1dfdd',
          400: '#d2d0ce',
          500: '#b3b0ad',
          600: '#979593',
          700: '#605e5c',
          800: '#323130',
          900: '#201f1e'
        },
        'ms-neutral': {
          50: '#faf9f8',
          100: '#f3f2f1',
          200: '#edebe9',
          300: '#e1dfdd',
          400: '#d2d0ce',
          500: '#b3b0ad',
          600: '#979593',
          700: '#605e5c',
          800: '#323130',
          900: '#201f1e'
        }
      },
      fontFamily: {
        'segoe': ['Segoe UI', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif']
      },
      boxShadow: {
        'fluent': '0 1.6px 3.6px rgba(0, 0, 0, 0.132), 0 0.3px 0.9px rgba(0, 0, 0, 0.108)',
        'fluent-lg': '0 6.4px 14.4px rgba(0, 0, 0, 0.132), 0 1.2px 3.6px rgba(0, 0, 0, 0.108)'
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        }
      }
    },
  },
  plugins: [],
}