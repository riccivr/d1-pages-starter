/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          cyan: "#00e5a3",
          blue: "#38bdf8",
        },
      },
    },
  },
  plugins: [],
};
