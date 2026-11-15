import { useCallback, useEffect, useRef, useState } from "react";

interface HyperTextProps {
  text: string;
  duration?: number;
  className?: string;
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const randomLetter = () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)];

// Texte qui se « décode » lettre par lettre (au chargement et au survol).
// Police à chasse fixe : les lettres changent sans faire bouger la mise en page.
export default function HyperText({ text, duration = 1600, className = "" }: HyperTextProps) {
  const [display, setDisplay] = useState(text);
  const frame = useRef(0);

  const run = useCallback(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    cancelAnimationFrame(frame.current);
    const start = performance.now();
    let last = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      // environ 30 changements par seconde, pas plus
      if (now - last > 33 || p === 1) {
        last = now;
        const revealed = p * text.length;
        setDisplay(
          text
            .split("")
            .map((c, i) => (c === " " || i < revealed ? c : randomLetter()))
            .join("")
        );
      }
      if (p < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }, [text, duration]);

  useEffect(() => {
    run();
    return () => cancelAnimationFrame(frame.current);
  }, [run]);

  const words = display.split(" ");
  return (
    <span className={`hypertext ${className}`} onMouseEnter={run}>
      <span className="sr-only">{text}</span>
      {words.map((w, i) => (
        <span key={i} className="hypertext__word" aria-hidden="true">
          {w}
        </span>
      ))}
    </span>
  );
}
