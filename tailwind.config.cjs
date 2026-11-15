/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#1F1154",
        secondary: "#F0EFEB",
        tertiary: "#0D3056",
        quaternary: "#1689C8",
      },

      // Animation du texte qui tourne (composant Position)
      keyframes: {
        textRotate1: {
          "0%, 40%": { transform: "translate3d(0, 0%, 0) rotateX(0deg)" },
          "60%, 100%": { transform: "translate3d(0, -100%, 0) rotateX(-90deg)" },
        },
        textRotate2: {
          "0%, 40%": { transform: "translate3d(0, 100%, 0) rotateX(-90deg)" },
          "60%, 100%": { transform: "translate3d(0, 0%, 0) rotateX(0deg)" },
        },
      },
      animation: {
        // "both" : chaque lettre prend sa position de départ avant son délai,
        // sinon les deux métiers s'affichent l'un sur l'autre au chargement
        textRotate1: "textRotate1 2.4s infinite alternate both",
        textRotate2: "textRotate2 2.4s infinite alternate both",
      },
    },
  },
  plugins: [],
};
