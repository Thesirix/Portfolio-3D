import { useState } from "react";
import { experiences } from "../data";
import { SectionWrapper } from "../hoc";
import { styles } from "../styles.js";
import Reveal from "./Reveal.jsx";

// Grand écran : liste des postes à gauche, détails du poste choisi à droite.
// Téléphone : chaque poste affiche ses détails dessous (rien de caché).
const Details = ({ details }) => (
  <ul className="list-none space-y-4 border-4 lg:border-8 border-white/80 rounded-xl lg:rounded-3xl p-5 lg:p-8">
    {details.map((detail, index) => (
      <li
        key={index}
        className="text-slate-400 font-semibold text-[clamp(0.95rem,1.35vw,1.6rem)] leading-snug"
        dangerouslySetInnerHTML={{ __html: detail }}
      />
    ))}
  </ul>
);

const Experience = () => {
  const [selected, setSelected] = useState(0);

  return (
    <>
      <Reveal from="down">
        <h2 id="experience-title" className={styles.sectionText}>
          Experience
        </h2>
      </Reveal>

      <div className="mt-10 md:mt-16 grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-12">
        <div className="flex flex-col gap-2 md:gap-4">
          {experiences.map((exp, index) => {
            const active = index === selected;
            return (
              <Reveal key={exp.title} delay={index * 0.06}>
                <button
                  type="button"
                  aria-pressed={active}
                  aria-controls="experience-details"
                  onClick={() => setSelected(index)}
                  className="group relative w-full text-left py-3 pl-6 md:pl-10 pr-2 cursor-pointer bg-transparent border-0"
                >
                  <span
                    className={`absolute left-0 top-3 bottom-3 w-2 md:w-4 transition-colors ${
                      active ? "bg-tertiary" : "bg-transparent group-hover:bg-tertiary/40"
                    }`}
                  />
                  <span
                    className={`block font-bold text-[clamp(1.15rem,1.7vw,2rem)] transition-colors max-md:text-quaternary ${
                      active ? "md:text-quaternary" : "md:text-slate-500"
                    }`}
                  >
                    {exp.title}
                  </span>
                  <span
                    className={`block pt-1 font-medium text-[clamp(0.95rem,1.3vw,1.5rem)] max-md:text-white ${
                      active ? "md:text-white" : "md:text-slate-500"
                    }`}
                  >
                    {exp.company_name} | {exp.date}
                  </span>
                </button>
                {/* Téléphone : détails sous chaque poste */}
                <div className="md:hidden mt-2 mb-4">
                  <Details details={exp.details} />
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* la clé relance l'animation d'entrée à chaque changement de poste */}
        <div id="experience-details" aria-live="polite" key={selected} className="hidden md:block fade-in-up">
          <Details details={experiences[selected].details} />
        </div>
      </div>
    </>
  );
};

export default SectionWrapper(Experience, "experience");
