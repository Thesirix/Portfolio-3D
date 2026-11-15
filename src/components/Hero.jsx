import SpacemanCanvas from "./Spaceman.jsx";
import Position from "./Position.jsx";
import HyperText from "./HyperText";

// Hero : couches du parallaxe empilées dans la même case de grille.
// La ligne du sol (--ground, voir index.css) sert de repère commun au cratère
// dessiné et à l'astronaute 3D, sur toutes les tailles d'écran.
const Hero = () => {
  return (
    <section className="parallax" aria-label="Présentation">
      {/* AVIF quand le navigateur le lit (2 fois plus léger), sinon WebP */}
      <img className="parallax__layer parallax__stars" src="/parallax/1Stars.webp" alt="" width="1920" height="768" />
      <picture>
        <source srcSet="/parallax/2Planets.avif" type="image/avif" />
        <img className="parallax__layer parallax__planets" src="/parallax/2Planets.webp" alt="" width="1920" height="1080" />
      </picture>
      <img className="parallax__layer parallax__sun" src="/parallax/6Sun.svg" alt="" width="250" height="140" />
      <picture>
        <source srcSet="/parallax/4Mountain.avif" type="image/avif" />
        <img className="parallax__layer parallax__mountain" src="/parallax/4Mountain.webp" alt="" width="1920" height="1080" />
      </picture>

      <div className="parallax__content hero">
        <div className="hero__title">
          <h1 className="hero__name">
            <HyperText text="RENAUD MERCIER" duration={1600} />
          </h1>
          <Position />
        </div>
        <p className="hero__tagline streaky-glow">
          I build digital homes where ideas find shelter and visitors feel welcomed
        </p>
      </div>

      <img className="parallax__layer parallax__crater" src="/parallax/5Crater.svg" alt="" width="250" height="77" />
      <SpacemanCanvas />
    </section>
  );
};

export default Hero;
