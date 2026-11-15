import { useEffect, useRef } from "react";

import { portfolio } from "../data";
import { SectionWrapper } from "../hoc";
import { styles } from "../styles.js";
import Reveal from "./Reveal.jsx";

// Vidéo d'aperçu : une image s'affiche d'abord ; la vidéo n'est téléchargée
// que lorsqu'elle est vraiment à l'écran, et mise en pause dès qu'elle en sort.
const PreviewVideo = ({ video, name }) => {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (el.preload !== "auto") {
            el.preload = "auto";
            el.load();
          }
          if (!reduceMotion) el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: 0.35 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      loop
      muted
      playsInline
      preload="none"
      poster={video.poster}
      width="1280"
      height="592"
      aria-label={`Aperçu du projet ${name}`}
      className="w-full h-auto object-cover rounded-3xl bg-tertiary"
    >
      <source src={video.src} type="video/mp4" />
    </video>
  );
};

const ProjectCard = ({ index, name, description, video }) => {
  const reversed = index % 2 === 1;
  return (
    <Reveal
      as="article"
      className={`flex flex-col gap-5 md:gap-10 md:items-center ${reversed ? "md:flex-row-reverse" : "md:flex-row"}`}
    >
      <div className="w-full md:w-3/5">
        <PreviewVideo video={video} name={name} />
      </div>
      <div className={`w-full md:w-2/5 ${reversed ? "md:text-right" : ""}`}>
        <h3 className="text-white font-semibold text-[clamp(1.25rem,2.6vw,2.5rem)] leading-tight">{name}</h3>
        <p className="mt-2 lg:mt-4 text-secondary text-[clamp(0.95rem,1.25vw,1.4rem)] leading-relaxed">{description}</p>
      </div>
    </Reveal>
  );
};

const Portfolio = () => (
  <>
    <Reveal from="down">
      <h2 id="portfolio-title" className={styles.sectionText}>
        Portfolio
      </h2>
    </Reveal>

    <div className="mt-10 md:mt-16 flex flex-col gap-14 md:gap-20">
      {portfolio.map((project, index) => (
        <ProjectCard key={project.name} index={index} {...project} />
      ))}
    </div>
  </>
);

export default SectionWrapper(Portfolio, "portfolio");
