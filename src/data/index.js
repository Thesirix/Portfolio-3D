import {

  mingle, 
  smcq,
ezbike,

} from "../assets";

export const navLinks = [
  {
    id: "hero",
    title: "Hero",
  },
  {
    id: "portfolio",
    title: "Portfolio",
  },
  {
    id: "experience",
    title: "Experience",
  },
  {
    id: "contact",
    title: "Contact",
  },
];

// Mise en avant (texte blanc) des mots clés dans les détails
const hl = (text) => `<span style='color: white;'>${text}</span>`;

const experiences = [
    {
      title: "Lead Full Stack Developer & DevOps",
      company_name: "ASFARFALHI Voyages",
      date: "Sept. 2024 - Sept. 2026",
      details: [
        `${hl("Tech lead")}: code reviews, security, UI and deployment decisions.`,
        `HR ERP in ${hl("Laravel")} with optimistic locking: ${hl("-40%")} data incidents.`,
        `${hl("CI/CD")} with GitHub Actions and ${hl("Docker")}: releases cut from ${hl("45 to 5 min")}.`,
        `Real-time queue system driving Android TV screens over ${hl("UDP")} and ${hl("WebSocket")} (${hl("100% uptime")}).`,
        `Automated payroll planning for ${hl("40+ employees")} (${hl("15 h/week")} saved).`,
      ],
    },
    {
      title: "Full Stack Developer",
      company_name: "AlternativeRVB",
      date: "July 2023 - Aug. 2024",
      details: [
        `University platform built from scratch: ${hl("React")} / ${hl("Tailwind")} SPA, Lighthouse ${hl("95+")}.`,
        `Secure REST API in ${hl("Express.js")} with roles for ${hl("50+ admins")}.`,
        `${hl("SQL / MongoDB")} indexing: real-time dashboards ${hl("30% faster")}.`,
      ],
    },
    {
      title: "Video Technician",
      company_name: "Self-employed",
      date: "March 2016 - May 2020",
      details: [
        `Digital ${hl("video control rooms")} for concerts, fairs and conventions (budgets up to ${hl("20k €")}).`,
        `${hl("Multi-camera")} capture, ${hl("live streaming")} and lead of ${hl("5+ technicians")}.`,
      ],
    }
  ];
  

const portfolio = [
  {
    name: "Mingle",
    description:
      "Mingle is a site for free service exchange, promoting mutual aid and community bonds without financial transactions.",
    video: mingle,
  },
  {
    name: "SMCQ",
    description:
      "SMCQ is a website for timed quizzes, where admins create questionnaires and candidates answer under time limits. It streamlines quiz management.",
    video: smcq,
  },
  {
    name: "EZ-Bike",
    description:
      "EZ-Bike is a site for real-time Velib availability, showing bike availability at stations instantly. It also features a CO2 calculator, combining practicality with an ecological focus.",
    video: ezbike,
  },
];

export { experiences, portfolio };

