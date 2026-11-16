// Liaison entre la page et la scène 3D (scene-core.js).
//
// La 3D tourne de préférence dans un Web Worker avec OffscreenCanvas : three.js
// et le modèle se préparent dans un second fil d'exécution, la page ne se fige
// jamais, même sur un petit téléphone. Si le navigateur ne sait pas faire
// (ancien Safari...), la scène tourne dans la page, comme avant.
//
// Ce fichier n'importe pas three.js : il reste minuscule. Il s'occupe de ce qui
// touche à la page : taille du canvas, visibilité, souris, clic.
const MODEL_URL = import.meta.env.BASE_URL + "models/spaceman.glb";

const canUseWorker = () =>
  typeof Worker !== "undefined" &&
  typeof OffscreenCanvas !== "undefined" &&
  "transferControlToOffscreen" in HTMLCanvasElement.prototype &&
  // ?main3d : forcer la scène dans la page (outil de l'image fixe, débogage)
  !new URLSearchParams(location.search).has("main3d");

// Démarre la scène dans un worker. Renvoie des commandes de même forme que
// celles de scene-core.js.
function startInWorker(canvas, init, { onReady, onCursor, onError }) {
  const worker = new Worker(new URL("./spaceman.worker.js", import.meta.url), { type: "module" });
  const offscreen = canvas.transferControlToOffscreen();
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.type === "ready") onReady();
    else if (m.type === "cursor") onCursor(m.on);
    else if (m.type === "error") onError(new Error(m.message));
  };
  worker.onerror = (e) => onError(e);
  worker.postMessage({ type: "init", canvas: offscreen, ...init }, [offscreen, init.model]);
  return {
    resize: (width, height) => worker.postMessage({ type: "resize", width, height }),
    setActive: (on) => worker.postMessage({ type: "active", on }),
    setPointer: (x, y) => worker.postMessage({ type: "pointer", x, y }),
    hover: (x, y) => worker.postMessage({ type: "hover", x, y }),
    click: (x, y) => worker.postMessage({ type: "click", x, y }),
    dispose: () => {
      worker.postMessage({ type: "dispose" });
      setTimeout(() => worker.terminate(), 500);
    },
  };
}

async function startInPage(canvas, init, { onCursor }) {
  const { createScene } = await import("./scene-core.js");
  return createScene({ canvas, ...init, onCursor });
}

export async function createSpacemanScene(container, { onReady } = {}) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // le modèle est préchargé par index.html : ce fetch le récupère tout de suite
  const model = await fetch(MODEL_URL).then((r) => {
    if (!r.ok) throw new Error(`modèle introuvable (${r.status})`);
    return r.arrayBuffer();
  });

  let canvas = null;
  const makeCanvas = () => {
    canvas?.remove();
    canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    container.appendChild(canvas);
    return canvas;
  };
  const init = () => ({
    model: model.slice(0), // copie : l'original reste disponible en cas de repli
    width: Math.max(1, container.clientWidth),
    height: Math.max(1, container.clientHeight),
    dpr: window.devicePixelRatio || 1,
    reduceMotion,
  });
  const onCursor = (on) => {
    if (canvas) canvas.style.cursor = on ? "pointer" : "";
  };

  // Lancement : worker si possible, sinon (ou s'il échoue) dans la page
  const ctrl = await new Promise((resolve, reject) => {
    const fallback = () => {
      startInPage(makeCanvas(), init(), { onCursor })
        .then((c) => {
          resolve(c);
          onReady?.();
        })
        .catch(reject);
    };
    if (!canUseWorker()) return fallback();
    let w;
    try {
      w = startInWorker(makeCanvas(), init(), {
        onReady: () => {
          resolve(w);
          onReady?.();
        },
        onCursor,
        onError: (err) => {
          console.warn("3D dans un worker impossible, repli dans la page :", err);
          w?.dispose();
          fallback();
        },
      });
    } catch (err) {
      fallback();
    }
  });

  // ── Ce qui se passe dans la page ───────────────────────────────────────
  const ro = new ResizeObserver(() => ctrl.resize(container.clientWidth, container.clientHeight));
  ro.observe(container);

  let visible = true;
  const update = () => ctrl.setActive(visible && !document.hidden);
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    update();
  });
  io.observe(container);
  document.addEventListener("visibilitychange", update);
  update();

  // La tête suit la souris / le doigt (repère : la tête du perso dans le canvas)
  let lastPointer = 0;
  const onPointerMove = (e) => {
    const now = performance.now();
    if (now - lastPointer < 30) return; // une trentaine de messages par seconde suffit
    lastPointer = now;
    const r = container.getBoundingClientRect();
    const cx = r.left + r.width * 0.6, cy = r.top + r.height * 0.35;
    const clamp = (v) => Math.max(-1, Math.min(1, v));
    ctrl.setPointer(clamp((e.clientX - cx) / (window.innerWidth * 0.5)), clamp((e.clientY - cy) / (window.innerHeight * 0.5)));
  };
  // souris hors de la page : il se remet bien de face
  const onLeave = () => ctrl.setPointer(0, 0);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  document.documentElement.addEventListener("mouseleave", onLeave);

  // Clic sur l'astronaute : il fait coucou (le test « sur lui ou pas » est fait par la scène)
  const toNdc = (e) => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1];
  };
  const onClick = (e) => ctrl.click(...toNdc(e));
  let lastHover = 0;
  const onHover = (e) => {
    const now = performance.now();
    if (now - lastHover < 60) return;
    lastHover = now;
    ctrl.hover(...toNdc(e));
  };
  canvas.addEventListener("click", onClick);
  canvas.addEventListener("pointermove", onHover, { passive: true });

  // Outil de l'image fixe (npm run model:poster) : scène dans la page uniquement
  if (import.meta.env.DEV && ctrl.firstFrame) window.__spaceman = { ...ctrl.debug, firstFrame: ctrl.firstFrame };

  return {
    dispose() {
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("pointermove", onHover);
      ctrl.dispose();
      canvas.remove();
    },
  };
}
