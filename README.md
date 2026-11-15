# Portfolio de Renaud Mercier

Site : [renaudmercier.com](https://renaudmercier.com/). React, Tailwind CSS, Vite, et un astronaute 3D en three.js dans le Hero.

## Lancer le projet

```bash
npm install
npm run dev       # serveur de dev
npm run build     # version de production dans dist/
npm run preview   # tester la version de production
```

Node 20.19 ou plus récent (Vite 8). Déploiement Netlify : réglages dans `netlify.toml`, formulaire de contact géré par Netlify Forms (déclaré dans `index.html`).

## Organisation

| Dossier / fichier | Rôle |
|---|---|
| `src/components/` | Sections du site (Hero, Portfolio, Experience, Contact), menu, notifications |
| `src/components/Reveal.jsx` | Apparition des éléments au scroll (animation CSS) |
| `src/three/scene-core.js` | Scène 3D du Hero : modèle, shaders, animations, cadrage (sans DOM) |
| `src/three/spaceman.worker.js` | Fait tourner la scène dans un second fil d'exécution (Web Worker + OffscreenCanvas) |
| `src/three/spaceman.js` | Liaison avec la page : choisit worker ou page, transmet taille, visibilité, souris, clic |
| `src/data/index.js` | Textes des projets et des expériences |
| `src/assets/` | Vidéos des projets (MP4) et leur image d'attente, icônes, son de notification |
| `src/index.css` | Styles globaux, parallaxe du Hero, placement de l'astronaute |
| `public/parallax/` | Calques du décor (étoiles en WebP, planètes et montagnes en AVIF + WebP de secours, soleil et cratère en SVG) |
| `public/models/spaceman.glb` | Le modèle 3D compressé |
| `public/spaceman-poster-*.webp` | Image fixe de l'astronaute, affichée avant la 3D |
| `public/apc.webp` | Image d'aperçu quand on partage le lien du site |
| `public/app-ads.txt`, `public/ads.txt` | Vérification Google (AdMob pour l'appli mobile) |
| `blender/spaceman.py` | **Source du modèle 3D** (script Blender) |

## L'astronaute 3D

Le modèle est entièrement généré par `blender/spaceman.py` : astronaute, rocher, feu de camp, squelette et animations. Rien n'est modélisé à la main, on modifie le script puis on régénère :

```bash
npm run model:export   # Blender en arrière-plan : blender/build/spaceman-raw.glb (+ spaceman.blend)
npm run model          # compression meshopt : public/models/spaceman.glb
npm run model:poster   # avec `npm run dev` lancé : refait l'image fixe public/spaceman-poster-*.webp
```

Blender 5.3 et Chrome sont attendus à leur emplacement par défaut sous Windows ; sinon, définir les variables d'environnement `BLENDER` et `CHROME`.

Pour le construire en direct dans un Blender ouvert (scène « Spaceman », sans export), via le MCP Blender :

```python
ns = bpy.app.driver_namespace
ns["sm_live"] = True
ns["sm_dir"] = "C:/Users/NOX/Desktop/the_netfiporfolio/Portfolio/blender"
exec(compile(open(ns["sm_dir"] + "/spaceman.py", encoding="utf-8").read(), "spaceman.py", "exec"), {"__name__": "sm_live"})
ns["sm_live"] = False
```

### Contenu du modèle

- **Spaceman** : le perso, un seul mesh (6 300 triangles) avec un squelette de 18 os.
- **Camp** : rocher et feu de camp (pierres, bûches, braises), 400 triangles, facettes plates.
- **Flame** : la flamme en 3 couches, animée dans le shader.
- 2 animations : `idle` (respiration, jambes qui balancent, marshmallow qui tourne, clignement des yeux) et `wave` (coucou quand on clique sur l'astronaute).

Pas de texture : la couleur est stockée par sommet, et la UV map sert de données (u = partie lumineuse comme les yeux ou les braises, v = vitre du casque pour le reflet).

### Sur la page

- La 3D se charge dès l'ouverture de la page, sur ordinateur comme sur téléphone, dans un **Web Worker** (OffscreenCanvas) : three.js, le modèle et les shaders se préparent dans un second fil d'exécution, la page ne se fige jamais. Navigateurs sans OffscreenCanvas : la scène tourne dans la page.
- Pendant ce court chargement, une image fixe occupe la place. C'est la première image exacte de l'animation (même pose, même flamme, braises calculées sans hasard) : quand la 3D prend le relais, l'astronaute se met simplement à bouger, sans saut.
- Appareils très faibles, mode économie de données ou « réduire les animations » : l'image fixe reste, pas de 3D.
- Il regarde le visiteur ; sa tête accompagne légèrement la souris. Un clic sur lui lance le coucou.
- Rendu en pause quand le Hero sort de l'écran ou que l'onglet est caché ; résolution qui baisse si l'appareil peine.

Le sol du modèle est posé dans le sol violet du cratère dessiné (`--ground` et `--sm-sink` dans `src/index.css`). Si on change le cadrage, `GROUND_FRACTION` (`src/three/spaceman.js`) et `--sm-ground` (`src/index.css`) doivent rester égaux, puis refaire l'image fixe (`npm run model:poster`).

## Optimisations

Lighthouse 12, version de production, mesuré le 14/11/2026 (mobile : téléphone lent simulé, processeur ralenti x4, réseau 4G lent) :

| | Performance | Accessibilité | Bonnes pratiques | SEO | Affichage principal (LCP) | Blocage (TBT) | Poids chargé |
|---|---|---|---|---|---|---|---|
| Avant (mobile) | 46 | 88 | 100 | 92 | 7,1 s | 1 690 ms | 1 507 Ko |
| Mobile | **93** | **100** | **100** | **100** | 3,2 s | 0 ms | 773 Ko |
| Ordinateur | **100** | **100** | **100** | **100** | 0,6 s | 0 ms | 364 Ko |

Décalage de mise en page (CLS) : 0 partout. Ces scores incluent la 3D chargée dès l'ouverture (grâce au worker, elle ne bloque rien).

| Avant | Après |
|---|---|
| JS au chargement 1 143 Ko (327 Ko gzip) : three.js, React Three Fiber, framer-motion, react-toastify... | 178 Ko (62 Ko gzip) ; three.js tourne dans un Web Worker, hors du fil principal de la page |
| Modèle 284 Ko : 28 meshes, 9 textures, 54 os, décodeur Draco à télécharger en plus | 80 Ko : 3 meshes, aucune texture, 18 os, compression meshopt (décodeur inclus dans three.js) |
| 28 dessins par image, 5 lumières, matériaux PBR | 5 dessins par image (0,14 ms), un matériau toon partagé |
| Vidéos 1896 px à 100 images/s, en MP4 + WebM (1,7 Mo), chargées et lues en permanence | MP4 1280 px à 30 images/s (400 Ko), image d'attente, chargées et lues seulement quand elles sont visibles |
| Script AdSense (300 Ko) chargé à chaque visite alors que le site n'a pas été accepté | Retiré (à remettre dans `index.html` en cas de nouvelle demande) |
| Image de 203 Ko affichée avant le démarrage (ancien astronaute) | Fond uni ; image d'aperçu des liens en WebP (72 Ko) |
| Police Montserrat jamais chargée (les visiteurs voyaient Arial) | Montserrat hébergée, 38 Ko, préchargée |
| `profile.png` 2,8 Mo inutilisé, `profile.webp` 165 Ko pour des particules de 45 px, icônes PNG non compressées | Supprimé ; 3 Ko ; icônes 60 à 70 % plus légères |
| Défilement dans une `div` de 100vh, mises en page codées par modèle d'appareil | Défilement normal, tailles fluides (`clamp`), parallaxe en CSS |
| Boucles d'animation permanentes (bouton RM, texte du nom redessiné toutes les 14 ms) | Boucles actives seulement pendant l'effet |

Images du décor : planètes et montagnes en AVIF (17 et 19 Ko au lieu de 40 et 37 Ko en WebP, le WebP reste en secours pour les vieux navigateurs) ; étoiles en WebP (16 Ko, l'AVIF est plus lourd sur ce calque plein de petits points nets) ; SVG du cratère et du soleil nettoyés des restes d'Illustrator (-40 %).

Les vidéos des projets restent en MP4 : c'est le format vidéo le plus léger lu partout (le WebM n'était pas plus petit et n'est pas lu par les iPhone d'avant iOS 17.4).

## Détails visuels conservés

- **Barre de défilement** (grands écrans) : fond `#0d3056`, poignée grise en dégradé, triangle cyan `#1cf0e3` en haut et magenta `#FF00FF` en bas. Les triangles sont dessinés dans les boutons de la barre (`::-webkit-scrollbar-button` dans `src/index.css`), car rien ne peut se poser par-dessus la barre de la page.
- **Barre de liens du contact** : ronds foncés en thème clair, ronds clairs en thème sombre (suit le thème de l'ordinateur), icônes qui grossissent à l'approche de la souris.
