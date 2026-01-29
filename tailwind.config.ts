import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        display: ["Sora", "system-ui", "sans-serif"],
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.15)',
        DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.2), 0 1px 2px -1px rgba(0, 0, 0, 0.2)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -2px rgba(0, 0, 0, 0.2)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.25), 0 4px 6px -4px rgba(0, 0, 0, 0.25)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.25)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
      },
      colors: {
        brand: {
          50: "#E8F4FE",
          100: "#C5E3FD",
          200: "#8EC8FB",
          300: "#57ACF9",
          400: "#2091F6",
          500: "#0C78F3",  // Main brand color
          600: "#0A60C2",
          700: "#074892",
          800: "#053061",
          900: "#021831",
        },
        accent: {
          50: "#FFF4ED",
          100: "#FFE9DB",
          200: "#FFD3B7",
          300: "#FFBD93",
          400: "#FFA76F",
          500: "#FF6B35",  // Main accent color
          600: "#E65520",
          700: "#B34218",
          800: "#802F11",
          900: "#4D1C0A",
        },
                // SUCCESS Green
        success: {
          50: "#F0FFF4",
          100: "#C6F6D5",
          200: "#9AE6B4",
          300: "#68D391",
          400: "#48BB78",  // Main success
          500: "#38A169",
          600: "#2F855A",
          700: "#276749",
          800: "#22543D",
          900: "#1C4532",
        },
        // ALERT Red
        alert: {
          50: "#FFF5F5",
          100: "#FED7D7",
          200: "#FEB2B2",
          300: "#FC8181",
          400: "#F56565",  // Main alert
          500: "#E53E3E",
          600: "#C53030",
          700: "#9B2C2C",
          800: "#822727",
          900: "#63171B",
        },
        // WARNING Yellow
        warning: {
          50: "#FFFFF0",
          100: "#FEFCBF",
          200: "#FAF089",
          300: "#F6E05E",
          400: "#ECC94B",  // Main warning
          500: "#D69E2E",
          600: "#B7791F",
          700: "#975A16",
          800: "#744210",
          900: "#5F370E",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
