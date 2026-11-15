import { useEffect, useState } from "react";
import { close, menu } from "../assets";
import { navLinks } from "../data";

// Menu fixe à droite. La section active est suivie avec un IntersectionObserver
// (aucun calcul pendant le scroll).
const Navbar = () => {
  const [active, setActive] = useState("hero");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sections = navLinks.map((l) => document.getElementById(l.id)).filter(Boolean);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      // la section active est celle qui traverse le milieu de l'écran
      { rootMargin: "-50% 0px -50% 0px" }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  // Échap ferme le menu mobile
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <nav className="navbar" aria-label="Navigation principale">
      <ul className="navbar__list">
        {navLinks.map((nav) => (
          <li key={nav.id}>
            <a
              href={`#${nav.id}`}
              className={`navbar__link ${active === nav.id ? "is-active" : ""}`}
              aria-current={active === nav.id ? "true" : undefined}
            >
              {nav.title}
            </a>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="navbar__toggle"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        onClick={() => setOpen(!open)}
      >
        <img src={open ? close : menu} alt="" width="28" height="28" />
      </button>

      <div id="mobile-menu" className="navbar__mobile" hidden={!open}>
        <ul>
          {navLinks.map((nav) => (
            <li key={nav.id}>
              <a
                href={`#${nav.id}`}
                className={active === nav.id ? "text-quaternary" : "text-secondary"}
                onClick={() => setOpen(false)}
              >
                {nav.title}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;
