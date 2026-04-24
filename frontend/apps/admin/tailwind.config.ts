import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ["JetBrains Mono", "monospace"],
        sans: ["Noto Sans SC", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
