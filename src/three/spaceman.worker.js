// Second fil d'exécution : toute la 3D tourne ici (OffscreenCanvas), la page
// reste donc fluide pendant le chargement de three.js et du modèle.
import { createScene } from "./scene-core.js";

let ctrl = null;
const queue = [];

self.onmessage = async (e) => {
  const msg = e.data;
  if (msg.type === "init") {
    try {
      ctrl = await createScene({ ...msg, onCursor: (on) => self.postMessage({ type: "cursor", on }) });
      queue.splice(0).forEach(run);
      self.postMessage({ type: "ready" });
    } catch (err) {
      self.postMessage({ type: "error", message: String(err?.message || err) });
    }
    return;
  }
  if (ctrl) run(msg);
  else queue.push(msg);
};

function run(msg) {
  switch (msg.type) {
    case "resize":
      ctrl.resize(msg.width, msg.height);
      break;
    case "active":
      ctrl.setActive(msg.on);
      break;
    case "pointer":
      ctrl.setPointer(msg.x, msg.y);
      break;
    case "hover":
      ctrl.hover(msg.x, msg.y);
      break;
    case "click":
      ctrl.click(msg.x, msg.y);
      break;
    case "dispose":
      ctrl.dispose();
      self.close();
      break;
  }
}
