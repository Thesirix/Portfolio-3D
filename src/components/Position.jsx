// Sous-titre qui bascule entre deux métiers (animation CSS, voir tailwind.config.cjs).
const produceSpans = (text, animation) =>
  text.split("").map((letter, index) => (
    <span
      key={index}
      className={`inline-block origin-bottom ${animation}`}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      {letter === " " ? " " : letter}
    </span>
  ));

const Position = () => (
  <p className="hero__position">
    <span className="sr-only">Web Developer, Creative Coder</span>
    <span className="hero__position-line" aria-hidden="true">
      {produceSpans("Web Developer", "animate-textRotate1")}
    </span>
    <span className="hero__position-line" aria-hidden="true">
      {produceSpans("Creative Coder", "animate-textRotate2")}
    </span>
  </p>
);

export default Position;
