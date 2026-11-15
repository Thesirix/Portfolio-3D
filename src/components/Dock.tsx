import React, { useRef } from "react";

// Barre de liens du contact : les icônes grossissent à l'approche de la souris
// (calcul direct sur les éléments, sans re-rendu React ni librairie d'animation).
const BASE = 48;
const MAGNIFICATION = 80;
const DISTANCE = 140;

const LINKS = [
  { icon: "gitHub", label: "GitHub", href: "https://github.com/Thesirix" },
  {
    icon: "gmail",
    label: "Envoyer un e-mail",
    href: "https://mail.google.com/mail/?view=cm&fs=1&to=renaud.d.mercier@gmail.com&su=Contact%20via%20le%20portfolio&body=Bonjour,%20j'ai%20vu%20votre%20portfolio%20et%20j'aimerais%20prendre%20contact%20avec%20vous.",
  },
  { icon: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/in/renaud-mercier/" },
  {
    icon: "whatsapp",
    label: "WhatsApp",
    href: "https://wa.me/33645175208?text=Bonjour,%20j'ai%20vu%20votre%20portfolio%20et%20j'aimerais%20prendre%20contact%20avec%20vous.",
  },
  { icon: "instagram", label: "Instagram", href: "https://www.instagram.com/art_trip_adventure/" },
];

export const Dock = ({ className = "" }: { className?: string }) => {
  const items = useRef<(HTMLSpanElement | null)[]>([]);

  const onMove = (e: React.MouseEvent) => {
    items.current.forEach((el) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const d = Math.abs(e.clientX - (r.left + r.width / 2));
      const k = Math.max(0, 1 - d / DISTANCE);
      el.style.setProperty("--size", `${BASE + (MAGNIFICATION - BASE) * k}px`);
    });
  };
  const onLeave = () => items.current.forEach((el) => el?.style.setProperty("--size", `${BASE}px`));

  return (
    <div className={`dock ${className}`} onMouseMove={onMove} onMouseLeave={onLeave}>
      {LINKS.map(({ icon, label, href }, index) => {
        const Icon = Icons[icon];
        return (
          <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
            <span className="dock__icon" ref={(el) => (items.current[index] = el)}>
              <Icon className="w-full h-full" aria-hidden="true" focusable="false" />
            </span>
          </a>
        );
      })}
    </div>
  );
};

const Icons: Record<string, (props: React.SVGProps<SVGSVGElement>) => React.ReactElement> = {
  gitHub: (props) => (
<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" 
fill="none" {...props}><g><path fill="#ffffff" fillRule="evenodd" d="M8 1C4.133 1 1 4.13 1 7.993c0 3.09 2.006 5.71 4.787 6.635.35.064.478-.152.478-.337 0-.166-.006-.606-.01-1.19-1.947.423-2.357-.937-2.357-.937-.319-.808-.778-1.023-.778-1.023-.635-.434.048-.425.048-.425.703.05 1.073.72 1.073.72.624 1.07 1.638.76 2.037.582.063-.452.244-.76.444-.935-1.554-.176-3.188-.776-3.188-3.456 0-.763.273-1.388.72-1.876-.072-.177-.312-.888.07-1.85 0 0 .586-.189 1.924.716A6.711 6.711 0 018 4.381c.595.003 1.194.08 1.753.236 1.336-.905 1.923-.717 1.923-.717.382.963.142 1.674.07 1.85.448.49.72 1.114.72 1.877 0 2.686-1.638 3.278-3.197 3.45.251.216.475.643.475 1.296 0 .934-.009 1.688-.009 1.918 0 .187.127.404.482.336A6.996 6.996 0 0015 7.993 6.997 6.997 0 008 1z" clipRule="evenodd"></path></g></svg>
  ),
  linkedin: (props) => (
<svg viewBox="2 2 13 13" xmlns="http://www.w3.org/2000/svg" 
fill="none" {...props}>
    <g 
   strokeWidth="0" 
    transform="translate(3.3600000000000003,3.3600000000000003), scale(0.58)"><rect x="-1.6" y="-1.6" 
    width="19.20" height="19.20" rx="0" fill="#ffffff" 
    strokeWidth="0"></rect></g><g><path fill="#0A66C2" d="M12.225 12.225h-1.778V9.44c0-.664-.012-1.519-.925-1.519-.926 0-1.068.724-1.068 1.47v2.834H6.676V6.498h1.707v.783h.024c.348-.594.996-.95 1.684-.925 1.802 0 2.135 1.185 2.135 2.728l-.001 3.14zM4.67 5.715a1.037 1.037 0 01-1.032-1.031c0-.566.466-1.032 1.032-1.032.566 0 1.031.466 1.032 1.032 0 .566-.466 1.032-1.032 1.032zm.889 6.51h-1.78V6.498h1.78v5.727zM13.11 2H2.885A.88.88 0 002 2.866v10.268a.88.88 0 00.885.866h10.226a.882.882 0 00.889-.866V2.865a.88.88 0 00-.889-.864z"></path></g></svg>

  ),
  
  gmail: (props) => (
    <svg viewBox="0 0 530 530" {...props} >
      <rect
        x="20"
        y="10"
        width="512"
        height="512"
        rx="50%"
        fill="#ffffff"
      />

      <path d="M178 391v-142l-82-63V361q0 30 30 30" fill="#4285f4"></path>
      <path d="M174 248l102 77l102-77v-98l-102 77l-102-77" fill="#ea4335"></path>
      <path d="M374 391v-142l82-63V361q0 30-30 30" fill="#34a853"></path>
      <path d="M96 188l82 63v-98l-30-23c-27-21-52 0-52 26" fill="#c5221f"></path>
      <path d="M456 188l-82 63v-98l30-23c27-21 52 0 52 26" fill="#fbbc04"></path>
    </svg>
  ),
  whatsapp: (props) => (
    <svg
    xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 175.216 175.552"
      {...props}>


      <defs>
        <linearGradient
          id="wa-grad"
          x1="85.915"
          x2="86.535"
          y1="32.567"
          y2="137.092"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#57d163" />
          <stop offset="1" stopColor="#23b33a" />
        </linearGradient>
        <filter
          id="wa-blur"
          width="1.115"
          height="1.114"
          x="-.057"
          y="-.057"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation="3.531" />
        </filter>
      </defs>
      <path
        fill="#b3b3b3"
        d="m54.532 138.45 2.235 1.324c9.387 5.571 20.15 8.518 31.126 8.523h.023c33.707 0 61.139-27.426 61.153-61.135.006-16.335-6.349-31.696-17.895-43.251A60.75 60.75 0 0 0 87.94 25.983c-33.733 0-61.166 27.423-61.178 61.13a60.98 60.98 0 0 0 9.349 32.535l1.455 2.312-6.179 22.558zm-40.811 23.544L24.16 123.88c-6.438-11.154-9.825-23.808-9.821-36.772.017-40.556 33.021-73.55 73.578-73.55 19.681.01 38.154 7.669 52.047 21.572s21.537 32.383 21.53 52.037c-.018 40.553-33.027 73.553-73.578 73.553h-.032c-12.313-.005-24.412-3.094-35.159-8.954zm0 0"
          filter="url(#wa-blur)"
      />
      <path
        fill="#fff"
        d="m12.966 161.238 10.439-38.114a73.42 73.42 0 0 1-9.821-36.772c.017-40.556 33.021-73.55 73.578-73.55 19.681.01 38.154 7.669 52.047 21.572s21.537 32.383 21.53 52.037c-.018 40.553-33.027 73.553-73.578 73.553h-.032c-12.313-.005-24.412-3.094-35.159-8.954z"
      />
      <path
        fill="url(#wa-grad)"
        d="M87.184 25.227c-33.733 0-61.166 27.423-61.178 61.13a60.98 60.98 0 0 0 9.349 32.535l1.455 2.313-6.179 22.558 23.146-6.069 2.235 1.324c9.387 5.571 20.15 8.517 31.126 8.523h.023c33.707 0 61.14-27.426 61.153-61.135a60.75 60.75 0 0 0-17.895-43.251 60.75 60.75 0 0 0-43.235-17.928z"
      />
      <path
        fill="#fff"
        fillRule="evenodd"
        d="M68.772 55.603c-1.378-3.061-2.828-3.123-4.137-3.176l-3.524-.043c-1.226 0-3.218.46-4.902 2.3s-6.435 6.287-6.435 15.332 6.588 17.785 7.506 19.013 12.718 20.381 31.405 27.75c15.529 6.124 18.689 4.906 22.061 4.6s10.877-4.447 12.408-8.74 1.532-7.971 1.073-8.74-1.685-1.226-3.525-2.146-10.877-5.367-12.562-5.981-2.91-.919-4.137.921-4.746 5.979-5.819 7.206-2.144 1.381-3.984.462-7.76-2.861-14.784-9.124c-5.465-4.873-9.154-10.891-10.228-12.73s-.114-2.835.808-3.751c.825-.824 1.838-2.147 2.759-3.22s1.224-1.84 1.836-3.065.307-2.301-.153-3.22-4.032-10.011-5.666-13.647"
      />
    </svg>
  ),
  instagram: (props) => (
    <svg
      version="1.1"
      id="Layer_1"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      viewBox="0 0 551.034 551.034"
      xmlSpace="preserve"
      fill="#000000"
      {...props}>


      <linearGradient
        id="ig-grad"
        gradientUnits="userSpaceOnUse"
        x1="275.517"
        y1="4.5714"
        x2="275.517"
        y2="549.7202"
        gradientTransform="matrix(1 0 0 -1 0 554)"
      >
        <stop offset="0" style={{ stopColor: "#E09B3D" }}></stop>
        <stop offset="0.3" style={{ stopColor: "#C74C4D" }}></stop>
        <stop offset="0.6" style={{ stopColor: "#C21975" }}></stop>
        <stop offset="1" style={{ stopColor: "#7024C4" }}></stop>
      </linearGradient>
      <path
        style={{ fill: "url(#ig-grad)" }}
        d="M386.878,0H164.156C73.64,0,0,73.64,0,164.156v222.722c0,90.516,73.64,164.156,164.156,164.156h222.722c90.516,0,164.156-73.64,164.156-164.156V164.156C551.033,73.64,477.393,0,386.878,0z M495.6,386.878c0,60.045-48.677,108.722-108.722,108.722H164.156c-60.045,0-108.722-48.677-108.722-108.722V164.156c0-60.046,48.677-108.722,108.722-108.722h222.722c60.045,0,108.722,48.676,108.722,108.722V386.878L495.6,386.878z"
      ></path>
      <path
        style={{ fill: "url(#ig-grad)" }}
        d="M275.517,133C196.933,133,133,196.933,133,275.516s63.933,142.517,142.517,142.517S418.034,354.1,418.034,275.516S354.101,133,275.517,133z M275.517,362.6c-48.095,0-87.083-38.988-87.083-87.083s38.989-87.083,87.083-87.083c48.095,0,87.083,38.988,87.083,87.083C362.6,323.611,323.611,362.6,275.517,362.6z"
      ></path>
      <circle
        style={{ fill: "url(#ig-grad)" }}
        cx="418.306"
        cy="134.072"
        r="34.149"
      ></circle>
    </svg>
  ),
  
};
