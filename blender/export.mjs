// Lance Blender en arrière-plan pour régénérer blender/build/spaceman-raw.glb.
// Chemin de Blender : variable d'environnement BLENDER, sinon l'installation
// par défaut de Blender 5.3 sous Windows.
import { spawnSync } from "node:child_process";

const blender = process.env.BLENDER ?? "C:\\Program Files\\Blender Foundation\\Blender 5.3\\blender.exe";
const r = spawnSync(blender, ["--background", "--python", "blender/spaceman.py"], { stdio: "inherit" });
if (r.error) {
  console.error(`Blender introuvable (${blender}). Définir la variable BLENDER.`);
  process.exit(1);
}
process.exit(r.status ?? 1);
