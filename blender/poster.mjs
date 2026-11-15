// Refait l'image fixe de l'astronaute (public/spaceman-poster-*.webp), affichée
// avant que la 3D ne démarre. C'est un rendu du modèle 3D lui-même, fond transparent.
//
// Usage : lancer `npm run dev` dans un terminal, puis `npm run model:poster`.
// Chrome est attendu à son emplacement par défaut sous Windows ; sinon, définir
// la variable d'environnement CHROME avec le chemin de chrome.exe.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ?main3d : la scène tourne dans la page (et non dans un worker) pour pouvoir lire son image
const URL_DEV = new URL("?main3d", process.argv[2] ?? "http://localhost:5173/").href;
const CHROME = process.env.CHROME ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9339;
const SIZES = [600, 900, 1140];

const chrome = spawn(CHROME, [
  "--headless=new",
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
  "--disable-extensions",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), "poster-"))}`,
  "about:blank",
]);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  let ver;
  for (let i = 0; i < 30 && !ver; i++) {
    await wait(300);
    ver = await fetch(`http://127.0.0.1:${PORT}/json/version`).then((r) => r.json()).catch(() => null);
  }
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    pending.get(d.id)?.(d);
    pending.delete(d.id);
  };
  await new Promise((r) => (ws.onopen = r));
  const send = (method, params = {}, sessionId) =>
    new Promise((res) => {
      const i = ++id;
      pending.set(i, res);
      ws.send(JSON.stringify({ id: i, method, params, sessionId }));
    });

  const { result: { targetId } } = await send("Target.createTarget", { url: "about:blank" });
  const { result: { sessionId } } = await send("Target.attachToTarget", { targetId, flatten: true });
  // grand écran : le canvas atteint sa taille maximale (760 x 608), en x1.5
  await send("Emulation.setDeviceMetricsOverride", { width: 1915, height: 1000, deviceScaleFactor: 1.5, mobile: false }, sessionId);
  await send("Page.navigate", { url: URL_DEV }, sessionId);
  await wait(3000);
  // la 3D démarre au premier geste : on simule un mouvement de souris
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 950, y: 500 }, sessionId);
  await wait(6000);

  const expr = `(() => {
    const s = window.__spaceman;
    if (!s) return null;
    s.firstFrame(); // même image que le tout premier rendu de la 3D sur le site
    const src = s.renderer.domElement;
    return ${JSON.stringify(SIZES)}.map((w) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = Math.round((w * src.height) / src.width);
      c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
      return c.toDataURL("image/webp", 0.7);
    });
  })()`;
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true }, sessionId);
  const images = r.result.result.value;
  if (!images) throw new Error("Scène 3D introuvable : le serveur de dev tourne-t-il (npm run dev) ?");
  SIZES.forEach((w, i) => {
    const out = join("public", `spaceman-poster-${w}.webp`);
    writeFileSync(out, Buffer.from(images[i].split(",")[1], "base64"));
    console.log("écrit :", out);
  });
  ws.close();
} finally {
  chrome.kill();
}
