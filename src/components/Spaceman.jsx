import { useEffect, useRef, useState } from "react";

const B = import.meta.env.BASE_URL;

// Appareils où l'on garde l'image fixe (pas de 3D) : économie de données,
// très peu de mémoire ou de cœurs, ou « réduire les animations » activé.
function prefersStatic() {
  const nav = navigator;
  return (
    nav.connection?.saveData === true ||
    (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) ||
    (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency <= 2) ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// Astronaute du Hero : une image fixe s'affiche tout de suite. C'est la première
// image exacte de l'animation 3D, donc quand la 3D prend le relais l'astronaute
// se met simplement à bouger, sans saut.
// La 3D se charge dès l'ouverture de la page (ordinateur comme téléphone) ;
// l'image fixe ne fait que combler ce court instant. three.js est dans un
// fichier à part et le modèle est préchargé (index.html), en parallèle du reste.
const SpacemanCanvas = () => {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (prefersStatic()) return;
    let cancelled = false;
    let scene = null;

    const start = async () => {
      try {
        const { createSpacemanScene } = await import("../three/spaceman.js");
        if (cancelled || !ref.current) return;
        const s = await createSpacemanScene(ref.current, { onReady: () => setReady(true) });
        if (cancelled) s.dispose();
        else scene = s;
      } catch (err) {
        // Pas de WebGL ou modèle introuvable : l'image fixe reste affichée
        console.warn("Astronaute 3D indisponible :", err);
      }
    };

    start();

    return () => {
      cancelled = true;
      scene?.dispose();
    };
  }, []);

  return (
    <div className="spaceman" data-ready={ready}>
      <img
        className="spaceman__poster"
        src={`${B}spaceman-poster-900.webp`}
        srcSet={`${B}spaceman-poster-600.webp 600w, ${B}spaceman-poster-900.webp 900w, ${B}spaceman-poster-1140.webp 1140w`}
        sizes="(max-width: 767px) min(125vw, 560px), clamp(300px, 46vw, 760px)"
        alt="Astronaute assis sur un rocher qui fait griller un marshmallow au-dessus d'un feu de camp"
        width="1140"
        height="912"
        decoding="async"
        fetchpriority="high"
      />
      <div ref={ref} className="spaceman__canvas" />
    </div>
  );
};

export default SpacemanCanvas;
