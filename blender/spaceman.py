# Génère l'astronaute du portfolio : perso + rocher + feu de camp, export GLB.
#
# Usage (export) :
#   blender --background --python blender/spaceman.py
#   puis npm run model   (compression meshopt, voir package.json)
#
# Mode direct : si bpy.app.driver_namespace["sm_live"] est vrai, tout est
# construit dans une scène "Spaceman" du Blender ouvert, sans export.
#
# Ce que contient le fichier exporté (3 meshes, aucune texture) :
# - "Spaceman" : le perso, un seul mesh avec squelette (18 os), 2 animations
#   (idle en boucle, wave quand on clique dessus).
# - "Camp" : rocher où il est assis + feu de camp (pierres, bûches, braises).
# - "Flame" : la flamme, animée dans le shader côté site.
#
# Couleurs : attribut de couleur par sommet (COLOR_0).
# UV (données, pas une texture) : u = lumière propre (0 à 1, ne dépend pas de
# l'éclairage), v = 1 pour la vitre du casque (reflet calculé dans le shader).
# Flamme : u = couche (0, 0.5, 1), v = hauteur dans la flamme.
#
# Règles (reprises du renard du projet summernight) :
# - peu de polygones, faces cachées dans le corps / le casque supprimées ;
# - pas de pièce de couleur posée sur une autre : quand la couleur change sur
#   une même forme (visière, ceinture, semelles), c'est la même surface,
#   découpée le long d'une courbe ;
# - toutes les faces orientées vers l'extérieur (le site n'affiche qu'un côté).
#
# Repère : Z vers le haut, le perso regarde -Y (= +Z dans three.js).
# Le sol (z = 0) correspond à la ligne du cratère dessiné dans le parallaxe.

import bpy, bmesh, math, os, random
from mathutils import Vector, Quaternion, Matrix

LIVE = bool(bpy.app.driver_namespace.get("sm_live"))
HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else bpy.app.driver_namespace.get("sm_dir", "")
ROOT = os.path.dirname(HERE)
OUT_RAW = os.path.join(HERE, "build", "spaceman-raw.glb")
OUT_BLEND = os.path.join(HERE, "build", "spaceman.blend")

random.seed(7)

if LIVE:
    scene = bpy.data.scenes.get("Spaceman") or bpy.data.scenes.new("Spaceman")
    bpy.context.window.scene = scene
    for o in list(scene.objects):
        bpy.data.objects.remove(o)
    for a in list(bpy.data.actions):
        if a.get("spaceman"):
            bpy.data.actions.remove(a)
else:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
COL = scene.collection


# ── Couleurs ────────────────────────────────────────────────────────────────
def hexcol(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


SUIT = hexcol("EEF0FA")      # combinaison
SUIT_DARK = hexcol("8E97CC")  # col, sac à dos, bottes
ACCENT = hexcol("FF8A3D")    # orange : gants, écouteurs, ceinture
VISOR = hexcol("1C2152")     # vitre du casque
EYE = hexcol("8CF4FF")
BLUSH = hexcol("FF86B6")
PANEL = hexcol("6E7FE0")
RED = hexcol("FF4D5E")
YELLOW = hexcol("FFD54A")
SOLE = hexcol("3B3F72")
STICK = hexcol("8A5A3C")
MALLOW = hexcol("FFF3E2")
ROCK = hexcol("8C7BD6")      # tons du cratère dessiné
ROCK2 = hexcol("6A58B4")
STONE = hexcol("54489A")
LOG = hexcol("7B4A3A")
LOG_END = hexcol("C98E5E")
COALS = hexcol("FF7A2A")

_mat_cache = {}


def preview_mat():
    """Matériau d'aperçu (Blender seulement) : affiche la couleur par sommet,
    faces arrière masquées comme sur le site. Retiré avant l'export."""
    m = bpy.data.materials.get("sm_preview")
    if not m:
        m = bpy.data.materials.new("sm_preview")
        m.use_nodes = True
        nt = m.node_tree
        bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
        attr = nt.nodes.new("ShaderNodeVertexColor")
        attr.layer_name = "Col"
        nt.links.new(attr.outputs[0], bsdf.inputs[0])
    m.use_backface_culling = True
    return m


# ── Outils de construction ──────────────────────────────────────────────────
def smooth01(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def new_obj(name, bm):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    COL.objects.link(o)
    return o


char_parts, camp_parts, flame_parts = [], [], []


def finish(o, color, weights=None, glow=0.0, glass=0.0, flat=False, group=None):
    """Couleur, UV de données, lissage et poids d'os d'une pièce.
    weights : nom d'os ou fonction(co) -> {os: poids}."""
    me = o.data
    me.uv_layers.new(name="UVMap")
    for d in me.uv_layers[0].data:
        d.uv = (glow, glass)
    ca = me.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
    for d in ca.data:
        d.color_srgb = (*color, 1.0)
    for p in me.polygons:
        p.use_smooth = not flat
    if weights is not None:
        if isinstance(weights, str):
            bone = weights
            weights = lambda co: {bone: 1.0}
        groups = {}
        for v in me.vertices:
            for b, w in weights(v.co).items():
                if w <= 0:
                    continue
                if b not in groups:
                    groups[b] = o.vertex_groups.new(name=b)
                groups[b].add([v.index], w, "REPLACE")
    me.materials.append(preview_mat())
    (group if group is not None else char_parts).append(o)
    return o


def paint(o, color, faces, glow=None, glass=None):
    """Repeint des faces (couleur, et éventuellement lumière propre / vitre)."""
    me = o.data
    ca = me.color_attributes["Col"]
    uv = me.uv_layers[0]
    for i in faces:
        for li in me.polygons[i].loop_indices:
            ca.data[li].color_srgb = (*color, 1.0)
            u, v = uv.data[li].uv
            uv.data[li].uv = (u if glow is None else glow, v if glass is None else glass)


def cut_bm(bm, val):
    """Découpe le maillage le long de la courbe f = 0 (val : {sommet: f}).
    La limite de couleur suit alors exactement la courbe, sans escalier."""
    cut_verts = set()
    for e in list(bm.edges):
        a, b = e.verts
        fa, fb = val[a], val[b]
        if (fa < 0) != (fb < 0) and abs(fa - fb) > 1e-9:
            _, nv = bmesh.utils.edge_split(e, a, fa / (fa - fb))
            val[nv] = 0.0
            cut_verts.add(nv)
    for face in list(bm.faces):
        vs = [v for v in face.verts if v in cut_verts]
        if len(vs) == 2 and vs[1] not in [e.other_vert(vs[0]) for e in vs[0].link_edges]:
            bmesh.utils.face_split(face, vs[0], vs[1])
    return cut_verts


def sphere_bm(segs, rings):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0)
    return bm


def superellipse(p, e=0.55):
    """Arrondi carré : pousse la sphère vers un cube aux coins ronds."""
    return Vector([math.copysign(abs(c) ** e, c) for c in p])


def ellipsoid(name, center, radii, color, bone, rot=None, segs=14, rings=9,
              deform=None, glow=0.0, group=None, flat=False):
    bm = sphere_bm(segs, rings)
    for v in bm.verts:
        p = v.co.copy()
        if deform:
            p = deform(p)
        p = Vector((p.x * radii[0], p.y * radii[1], p.z * radii[2]))
        if rot:
            p = rot @ p
        v.co = p + Vector(center)
    return finish(new_obj(name, bm), color, bone, glow=glow, group=group, flat=flat)


def loft(name, path, dpath, radius, color, weights, n=8, seg=10, cap_rings=3,
         glow=0.0, group=None, flat=False, up=None):
    """Tube le long de path(t), t dans [0,1], rayon radius(t), bouts arrondis."""
    bm = bmesh.new()
    if up is None:
        up = Vector((1, 0, 0)) if abs(dpath(0).normalized().x) < 0.9 else Vector((0, 1, 0))
    prev = Vector(up)
    fr = []
    for i in range(n + 1):
        t = i / n
        P, T = path(t), dpath(t).normalized()
        N = (prev - T * prev.dot(T)).normalized()
        prev = N
        fr.append((P, T, N, T.cross(N), radius(t)))

    def ring(P, N, B, r):
        return [bm.verts.new(P + (N * math.cos(2 * math.pi * k / seg) + B * math.sin(2 * math.pi * k / seg)) * r)
                for k in range(seg)]

    P, T, N, B, r0 = fr[0]
    pole0 = bm.verts.new(P - T * r0)
    rings = [ring(P - T * r0 * math.sin(a), N, B, r0 * math.cos(a))
             for a in [(math.pi / 2) * j / cap_rings for j in range(cap_rings - 1, 0, -1)]]
    rings += [ring(P, N, B, r) for P, T, N, B, r in fr]
    P, T, N, B, r1 = fr[-1]
    rings += [ring(P + T * r1 * math.sin(a), N, B, r1 * math.cos(a))
              for a in [(math.pi / 2) * j / cap_rings for j in range(1, cap_rings)]]
    pole1 = bm.verts.new(P + T * r1)
    for k in range(seg):
        k2 = (k + 1) % seg
        bm.faces.new((pole0, rings[0][k2], rings[0][k]))
        bm.faces.new((rings[-1][k], rings[-1][k2], pole1))
    for i in range(len(rings) - 1):
        for k in range(seg):
            k2 = (k + 1) % seg
            bm.faces.new((rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(new_obj(name, bm), color, weights, glow=glow, group=group, flat=flat)


def torus(name, center, R, r, color, bone, segs=24, tube=8):
    bm = bmesh.new()
    vs = []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        ca, sa = math.cos(a), math.sin(a)
        vs.append([bm.verts.new(Vector(center) + Vector(((R + r * math.cos(b)) * ca, (R + r * math.cos(b)) * sa, r * math.sin(b))))
                   for b in [2 * math.pi * j / tube for j in range(tube)]])
    for i in range(segs):
        i2 = (i + 1) % segs
        for j in range(tube):
            j2 = (j + 1) % tube
            bm.faces.new((vs[i][j], vs[i2][j], vs[i2][j2], vs[i][j2]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(new_obj(name, bm), color, bone)


def seg_path(a, b, c):
    """Chemin quadratique a -> c tiré vers b (coude, genou)."""
    a, b, c = Vector(a), Vector(b), Vector(c)
    return (lambda t: a * (1 - t) ** 2 + b * 2 * (1 - t) * t + c * t * t,
            lambda t: (b - a) * 2 * (1 - t) + (c - b) * 2 * t)


def seg_dist(p, a, b):
    a, b = Vector(a), Vector(b)
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * t)).length


def limb_weights(a, b, c, upper, lower, blend=0.05):
    """Poids d'un membre a-b-c : os du haut près de a-b, du bas près de b-c,
    fondu doux autour du coude / genou."""
    def w(co):
        d1, d2 = seg_dist(co, a, b), seg_dist(co, b, c)
        s = smooth01(0.5 + (d1 - d2) / blend)
        return {upper: 1 - s, lower: s}
    return w


def track(direction, axis="-Y", up="Z"):
    return Vector(direction).normalized().to_track_quat(axis, up).to_matrix()


# ── Perso ───────────────────────────────────────────────────────────────────
SEAT = 0.30          # dessus du rocher
# Place du perso (et de son rocher) par rapport au feu : il est construit
# autour de l'origine puis déplacé de CHAR_OFF, à droite du feu et plus près
# de la caméra. Le bout de la brochette, lui, reste au-dessus du feu.
CHAR_OFF = Vector((0.16, -0.34, 0.0))
HELMET_C = Vector((0.0, 0.0, 0.88))
HELMET_R = 0.23


def pear(p):
    """Corps : plus large en bas, assise aplatie."""
    q = p.copy()
    k = 1 + 0.15 * (-q.z)
    q.x *= k
    q.y *= k
    if q.z < -0.6:
        q.z = -0.6 + (q.z + 0.6) * 0.4
    return q


def body_weights(co):
    s = smooth01((co.z - 0.42) / 0.12)
    return {"hips": 1 - s, "spine": s}


body = ellipsoid("body", (0, 0.02, 0.49), (0.165, 0.15, 0.21), SUIT, body_weights,
                 segs=20, rings=14, deform=pear)

# Ceinture orange : bande découpée dans le corps (anneaux horizontaux)
bm = bmesh.new()
bm.from_mesh(body.data)
for z0 in (0.40, 0.44):
    cut_bm(bm, {v: v.co.z - z0 for v in bm.verts})
bm.to_mesh(body.data)
bm.free()
body.data.update()
paint(body, ACCENT, [p.index for p in body.data.polygons
                     if 0.40 - 1e-4 < p.center.z < 0.44 + 1e-4
                     and all(0.40 - 1e-4 <= body.data.vertices[i].co.z <= 0.44 + 1e-4 for i in p.vertices)])

# Col du casque
torus("collar", (0, 0.01, 0.675), 0.125, 0.034, SUIT_DARK, "spine", segs=22, tube=8)


# Casque : sphère dont l'avant est découpé en visière (vitre sombre bombée)
def helmet_dir(theta, phi):
    return Vector((math.sin(theta) * math.cos(phi), -math.cos(theta) * math.cos(phi), math.sin(phi)))


def visor_f(p):
    """< 0 dans la visière. p : point de la sphère unité."""
    th = math.atan2(p.x, -p.y)
    ph = math.asin(max(-1.0, min(1.0, p.z)))
    return (th / 0.86) ** 2 + ((ph + 0.03) / 0.56) ** 2 - 1


bm = sphere_bm(32, 20)
val = {v: visor_f(v.co) for v in bm.verts}
cut_bm(bm, val)
for v in bm.verts:
    f = val[v]
    bulge = 1 + 0.035 * smooth01(-f / 0.3) if f < 0 else 1.0
    v.co = HELMET_C + v.co.normalized() * HELMET_R * bulge
helmet = new_obj("helmet", bm)
finish(helmet, SUIT, "head")
paint(helmet, VISOR, [p.index for p in helmet.data.polygons
                      if visor_f((p.center - HELMET_C).normalized()) < 0], glass=1.0)

VISOR_SURF = HELMET_R * 1.035


def on_visor(theta, phi, depth):
    d = helmet_dir(theta, phi)
    return HELMET_C + d * (VISOR_SURF - depth), d


# Yeux (écran de la visière), joues et sourire : posés dans la vitre
EYE_Z = None
for side in (-1, 1):
    c, d = on_visor(0.29 * side, 0.03, 0.002)
    EYE_Z = c.z
    ellipsoid(f"eye{side}", c, (0.027, 0.011, 0.043), EYE, "eyes", rot=track(d, "-Y"),
              segs=12, rings=8, glow=1.0)
    c, d = on_visor(0.53 * side, -0.14, 0.003)
    ellipsoid(f"blush{side}", c, (0.032, 0.008, 0.017), BLUSH, "head", rot=track(d, "-Y"),
              segs=12, rings=6, glow=0.55)


def smile_path(t):
    th = -0.085 + 0.17 * t
    ph = -0.14 + 0.07 * (th / 0.085) ** 2 - 0.035
    return on_visor(th, ph, -0.001)[0]


def smile_d(t, e=1e-3):
    return (smile_path(min(1, t + e)) - smile_path(max(0, t - e)))


loft("smile", smile_path, smile_d, lambda t: 0.0065, EYE, "head", n=6, seg=6, cap_rings=2, glow=1.0)

# Écouteurs orange sur les côtés du casque
for side in (-1, 1):
    a = Vector((0.200 * side, 0.01, 0.88))
    b = Vector((0.252 * side, 0.01, 0.88))
    loft(f"earpod{side}", lambda t, a=a, b=b: a.lerp(b, t), lambda t, a=a, b=b: b - a,
         lambda t: 0.062, ACCENT, "head", n=1, seg=16, cap_rings=3)

# Antenne (os à part pour qu'elle balance) + boule lumineuse
ad = helmet_dir(1.95, 0.72)
ANT_A = HELMET_C + ad * (HELMET_R - 0.01)
ANT_B = ANT_A + Vector((0.035, 0.03, 0.13))
loft("antenna", lambda t: ANT_A.lerp(ANT_B, t), lambda t: ANT_B - ANT_A, lambda t: 0.009,
     SUIT_DARK, "antenna", n=3, seg=6, cap_rings=2)
ellipsoid("antenna_ball", ANT_B, (0.03, 0.03, 0.03), ACCENT, "antenna", segs=10, rings=7, glow=0.85)

# Sac à dos + petite lumière
ellipsoid("backpack", (0, 0.175, 0.53), (0.155, 0.08, 0.17), SUIT_DARK, "spine",
          segs=16, rings=10, deform=superellipse)
ellipsoid("pack_light", (0.085, 0.19, 0.70), (0.022, 0.022, 0.022), EYE, "spine", segs=8, rings=6, glow=1.0)

# Boîtier sur la poitrine + 2 boutons
ellipsoid("chestbox", (0, -0.145, 0.53), (0.075, 0.032, 0.056), PANEL, "spine",
          segs=14, rings=8, deform=superellipse)
for x, col in ((-0.032, RED), (0.032, YELLOW)):
    ellipsoid(f"button{x}", (x, -0.176, 0.535), (0.013, 0.008, 0.013), col, "spine", segs=8, rings=6, glow=0.6)

# Bras : gauche (+X) posé sur la cuisse, droit (-X) tient la brochette
ARMS = {
    "L": ((0.15, 0.02, 0.60), (0.255, -0.01, 0.48), (0.215, -0.14, 0.415)),
    "R": ((-0.15, 0.02, 0.60), (-0.27, -0.03, 0.50), (-0.27, -0.17, 0.50)),
}
HANDS = {}
for s, (S, E, W) in ARMS.items():
    p, dp = seg_path(S, E, W)
    loft(f"arm{s}", p, dp, lambda t: 0.052 - 0.008 * t, SUIT,
         limb_weights(Vector(S), Vector(E), Vector(W), f"upperarm_{s}", f"forearm_{s}"),
         n=10, seg=10, cap_rings=2)
    fdir = (Vector(W) - Vector(E)).normalized()
    hc = Vector(W) + fdir * 0.045
    HANDS[s] = (hc, fdir)
    rot = track(fdir, "Y", "Z")
    ellipsoid(f"hand{s}", hc, (0.05, 0.058, 0.045), ACCENT, f"hand_{s}", rot=rot, segs=12, rings=8)
    side = 1 if s == "L" else -1
    thumb = hc + rot @ Vector((-0.035 * side, 0.0, 0.03))
    ellipsoid(f"thumb{s}", thumb, (0.018, 0.026, 0.018), ACCENT, f"hand_{s}", rot=rot, segs=8, rings=6)

# Brochette + marshmallow (tenus par la main droite)
FIRE = Vector((-0.53, -0.50, 0.0))
hc, _ = HANDS["R"]
ST_A = hc + Vector((0.03, 0.03, -0.02))
# bout de la brochette : juste à côté de la flamme (repère du feu), ramené
# dans le repère du perso qui sera déplacé de CHAR_OFF
ST_B = Vector((-0.43, -0.43, 0.44)) - CHAR_OFF
ST_M = (ST_A + ST_B) / 2 + Vector((0, 0, 0.07))
sp, sdp = seg_path(ST_A, ST_M, ST_B)
loft("stick", sp, sdp, lambda t: 0.009 - 0.003 * t, STICK, "hand_R", n=8, seg=6, cap_rings=2)
mdir = sdp(1).normalized()
M0 = ST_B - mdir * 0.005
M1 = ST_B + mdir * 0.055
loft("mallow", lambda t: M0.lerp(M1, t), lambda t: M1 - M0, lambda t: 0.03, MALLOW, "hand_R",
     n=2, seg=12, cap_rings=2, glow=0.2)

# Jambes : assis, cuisses à l'horizontale, pieds dans le vide
LEGS = {
    "L": ((0.085, -0.02, 0.37), (0.10, -0.215, 0.37), (0.10, -0.245, 0.175)),
    "R": ((-0.085, -0.02, 0.37), (-0.10, -0.215, 0.37), (-0.10, -0.245, 0.175)),
}
SOLE_Z = 0.093
for s, (H, K, A) in LEGS.items():
    p, dp = seg_path(H, K, A)
    loft(f"leg{s}", p, dp, lambda t: 0.068 - 0.01 * t, SUIT,
         limb_weights(Vector(H), Vector(K), Vector(A), f"thigh_{s}", f"shin_{s}"),
         n=10, seg=10, cap_rings=2)
    # Botte : semelle découpée dans la même forme
    bc = Vector((A[0], -0.275, 0.13))
    bm = sphere_bm(14, 10)
    for v in bm.verts:
        q = superellipse(v.co, 0.7)
        q.y *= 1.0 + 0.25 * max(0.0, -q.y)  # plus longue devant
        v.co = bc + Vector((q.x * 0.064, q.y * 0.085, q.z * 0.062))
    val = {v: v.co.z - SOLE_Z for v in bm.verts}
    cut_bm(bm, val)
    boot = new_obj(f"boot{s}", bm)
    finish(boot, SUIT_DARK, f"shin_{s}")
    paint(boot, SOLE, [p.index for p in boot.data.polygons if p.center.z < SOLE_Z])


# ── Faces cachées dans le corps et le casque ────────────────────────────────
bpy.context.view_layer.update()


def main_bone(o):
    best, bw = None, -1
    for vg in o.vertex_groups:
        w = sum(g.weight for v in o.data.vertices for g in v.groups if g.group == vg.index)
        if w > bw:
            best, bw = vg.name, w
    return best


SHELLS = {body: "spine", helmet: "head"}


def cull_hidden():
    todo = []
    for o in char_parts:
        bone = main_bone(o)
        tests = [(sh, 0.004 if b == bone else 0.03) for sh, b in SHELLS.items() if sh is not o]
        inside = []
        for v in o.data.vertices:
            ins = False
            for sh, margin in tests:
                ok, loc, nor, _ = sh.closest_point_on_mesh(v.co)
                if ok and (v.co - loc).dot(nor) < -margin:
                    ins = True
                    break
            inside.append(ins)
        todo.append((o, inside))
    removed = 0
    for o, inside in todo:
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bm.verts.ensure_lookup_table()
        dead = [f for f in bm.faces if all(inside[v.index] for v in f.verts)]
        removed += len(dead)
        bmesh.ops.delete(bm, geom=dead, context="FACES")
        bm.to_mesh(o.data)
        bm.free()
    return removed


print("faces cachées supprimées :", cull_hidden())


# ── Rocher et feu de camp (décor fixe, facettes plates) ────────────────────
def rock_bm(subdiv, jitter, seed):
    rnd = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    for v in bm.verts:
        v.co *= 1 + rnd.uniform(-jitter, jitter)
    return bm


def rock(name, center, radii, z_top, color, seed, subdiv=2, jitter=0.12, top_color=None):
    bm = rock_bm(subdiv, jitter, seed)
    for v in bm.verts:
        p = Vector((v.co.x * radii[0], v.co.y * radii[1], v.co.z * radii[2])) + Vector(center)
        p.z = max(0.0, min(z_top, p.z))
        v.co = p
    # le dessous (posé sur le sol) n'est jamais visible
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if all(v.co.z < 1e-4 for v in f.verts)], context="FACES")
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    o = new_obj(name, bm)
    finish(o, color, None, group=camp_parts, flat=True)
    if top_color:
        paint(o, top_color, [p.index for p in o.data.polygons if p.normal.z > 0.75])
    return o


rock("seat", CHAR_OFF + Vector((0, 0.07, 0.10)), (0.29, 0.22, 0.30), SEAT, ROCK2, 3, top_color=ROCK)
rock("seat_b", CHAR_OFF + Vector((0.30, 0.16, 0.0)), (0.12, 0.10, 0.10), 0.09, ROCK2, 11, subdiv=1, top_color=ROCK)

# Pierres autour du feu
for i in range(8):
    a = 2 * math.pi * i / 8 + 0.2
    r = 0.165
    c = FIRE + Vector((math.cos(a) * r, math.sin(a) * r, 0.02))
    s = 0.05 + 0.015 * random.random()
    rock(f"stone{i}", c, (s * 1.2, s, s * 0.8), 1.0, STONE, 20 + i, subdiv=1, jitter=0.18)

# Bûches en tipi
APEX = FIRE + Vector((0, 0, 0.24))
for i in range(4):
    a = math.pi / 4 + i * math.pi / 2 + random.uniform(-0.15, 0.15)
    base = FIRE + Vector((math.cos(a) * 0.12, math.sin(a) * 0.12, 0.015))
    top = base.lerp(APEX, 0.82)
    o = loft(f"log{i}", lambda t, b=base, e=top: b.lerp(e, t), lambda t, b=base, e=top: e - b,
             lambda t: 0.021, LOG, None, n=1, seg=6, cap_rings=1, group=camp_parts, flat=True)
    d = (top - base).normalized()
    ends = [p.index for p in o.data.polygons if abs(p.normal.dot(d)) > 0.7]
    paint(o, LOG_END, ends)

# Braises
ellipsoid("coals", FIRE + Vector((0, 0, 0.0)), (0.095, 0.095, 0.035), COALS, None, segs=10, rings=5,
          glow=1.0, group=camp_parts, flat=True)


# ── Flamme (3 couches, déformées dans le shader du site) ───────────────────
FLAME_LAYERS = [  # hauteur, rayon, couleur
    (0.40, 0.092, hexcol("FF4A1C")),
    (0.30, 0.068, hexcol("FF9A1F")),
    (0.19, 0.040, hexcol("FFE46B")),
]
for li, (h, R, colr) in enumerate(FLAME_LAYERS):
    z0 = 0.03
    a, b = FIRE + Vector((0, 0, z0)), FIRE + Vector((0, 0, z0 + h))

    def rad(t, R=R):
        return max(0.002, R * 2.9 * (t ** 0.5) * ((1 - t) ** 1.3))
    o = loft(f"flame{li}", lambda t, a=a, b=b: a.lerp(b, t), lambda t, a=a, b=b: b - a, rad, colr,
             None, n=10, seg=10, cap_rings=1, group=flame_parts, up=Vector((1, 0, 0)))
    uv = o.data.uv_layers[0]
    for poly in o.data.polygons:
        for li2 in poly.loop_indices:
            z = o.data.vertices[o.data.loops[li2].vertex_index].co.z
            uv.data[li2].uv = (li / 2, max(0.0, min(1.0, (z - a.z) / h)))

print("perso :", sum(len(o.data.vertices) for o in char_parts), "sommets,",
      sum(len(p.vertices) - 2 for o in char_parts for p in o.data.polygons), "triangles")
print("décor :", sum(len(p.vertices) - 2 for o in camp_parts for p in o.data.polygons), "triangles")


# ── Fusion ──────────────────────────────────────────────────────────────────
def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    o.data.name = name
    return o


spaceman = join(char_parts, "Spaceman")
spaceman.data.transform(Matrix.Translation(CHAR_OFF))
camp = join(camp_parts, "Camp")
flame = join(flame_parts, "Flame")

# ── Squelette ───────────────────────────────────────────────────────────────
arm_data = bpy.data.armatures.new("SpacemanRig")
arm = bpy.data.objects.new("SpacemanRig", arm_data)
COL.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")


def hand_tail(s):
    hc, fdir = HANDS[s]
    return tuple(hc + fdir * 0.05)


BONES = [
    ("hips", None, (0, 0.02, 0.33), (0, 0.02, 0.47)),
    ("spine", "hips", (0, 0.02, 0.47), (0, 0.02, 0.67)),
    ("head", "spine", (0, 0.0, 0.67), (0, 0.0, 1.0)),
    ("eyes", "head", (0, -0.2, EYE_Z), (0, -0.2, EYE_Z + 0.06)),
    ("antenna", "head", tuple(ANT_A), tuple(ANT_B)),
    ("thigh_L", "hips", LEGS["L"][0], LEGS["L"][1]),
    ("shin_L", "thigh_L", LEGS["L"][1], LEGS["L"][2]),
    ("thigh_R", "hips", LEGS["R"][0], LEGS["R"][1]),
    ("shin_R", "thigh_R", LEGS["R"][1], LEGS["R"][2]),
]
for s in "LR":
    S, E, W = ARMS[s]
    BONES += [
        (f"upperarm_{s}", "spine", S, E),
        (f"forearm_{s}", f"upperarm_{s}", E, W),
        (f"hand_{s}", f"forearm_{s}", W, hand_tail(s)),
    ]
for name, parent, h, t in BONES:
    eb = arm_data.edit_bones.new(name)
    eb.head = Vector(h) + CHAR_OFF
    eb.tail = Vector(t) + CHAR_OFF
    eb.roll = 0.0
    if parent:
        eb.parent = arm_data.edit_bones[parent]
        eb.use_connect = False
bpy.ops.object.mode_set(mode="OBJECT")

spaceman.parent = arm
mod = spaceman.modifiers.new("Armature", "ARMATURE")
mod.object = arm

# ── Animations (rotations seulement, + échelle des yeux pour le clignement) ─
FPS = 24
scene.render.fps = FPS
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))


def axis_of(bone):
    b = arm_data.bones[bone]
    return (b.tail_local - b.head_local).normalized()


def set_pose(rots, eyes=1.0):
    """rots: {os: [(axe, degrés), ...]} (axes du repère du perso)."""
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
        q_world = Quaternion()
        for axis, deg in rots.get(pb.name, []):
            q_world = Quaternion(axis, math.radians(deg)) @ q_world
        rest = pb.bone.matrix_local.to_quaternion()
        pb.rotation_quaternion = rest.inverted() @ q_world @ rest
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)
    arm.pose.bones["eyes"].scale = (1, eyes, 1)


def make_action(name, n_frames, pose_fn):
    act = bpy.data.actions.new(name)
    act["spaceman"] = True
    act.use_fake_user = True
    arm.animation_data_create()
    arm.animation_data.action = act
    for f in range(n_frames + 1):
        u = f / n_frames
        rots, eyes = pose_fn(u)
        set_pose(rots, eyes)
        for pb in arm.pose.bones:
            pb.keyframe_insert("rotation_quaternion", frame=f)
        arm.pose.bones["eyes"].keyframe_insert("scale", frame=f)
    arm.animation_data.action = None
    return act


def blink(u, at, dur=0.035):
    d = abs(u - at)
    return 1.0 - 0.9 * (1 - smooth01(d / dur)) if d < dur else 1.0


# Bras droit vers le feu : axe du bâton pour faire tourner le marshmallow
STICK_AX = (ST_B - ST_A).normalized()


def idle(u):
    t = 2 * math.pi * u
    s = math.sin(t)
    k = 2 * t  # deux balancements de jambes par boucle
    return {
        "spine": [(X, 2.0 * s), (Y, 1.5 * math.sin(t + 0.6))],
        "head": [(X, -3 * math.sin(t + 0.4)), (Y, 5 * math.sin(t - 0.3))],
        "antenna": [(Y, 14 * math.sin(t - 1.4)), (X, 6 * math.sin(2 * t - 1.0))],
        "thigh_L": [(X, 4 * math.sin(k))],
        "thigh_R": [(X, -4 * math.sin(k))],
        "shin_L": [(X, -22 * math.sin(k + 0.5))],
        "shin_R": [(X, 22 * math.sin(k + 0.5))],
        "upperarm_L": [(X, 2 * s)],
        "forearm_L": [(Y, 3 * math.sin(t + 1))],
        "upperarm_R": [(X, 3 * math.sin(t + 0.8)), (Z, 2 * s)],
        "forearm_R": [(STICK_AX, 0)],
        "hand_R": [(STICK_AX, 25 * math.sin(t))],
    }, min(blink(u, 0.32), blink(u, 0.78))


def wave(u):
    # entrée / sortie douces pour revenir à la pose de repos
    e = smooth01(u / 0.18) * smooth01((1 - u) / 0.22)
    w = math.sin(2 * math.pi * 3 * u)
    return {
        "spine": [(Y, -5 * e)],
        "head": [(Y, 12 * e), (X, -6 * e)],
        "antenna": [(Y, 18 * e * math.sin(2 * math.pi * 3 * u - 1.0))],
        "upperarm_L": [(Y, -88 * e), (X, -30 * e)],
        "forearm_L": [(Y, -(60 + 24 * w) * e)],
        "hand_L": [(Y, -12 * w * e)],
        "shin_L": [(X, -15 * e)],
        "shin_R": [(X, 10 * e)],
        "hand_R": [(STICK_AX, 0)],
    }, blink(u, 0.55)


make_action("idle", 96, idle)
make_action("wave", 60, wave)
set_pose({})

# Aperçu : boucle idle dans la timeline
arm.animation_data_create()
arm.animation_data.action = bpy.data.actions["idle"] if "idle" in bpy.data.actions else None
scene.frame_start, scene.frame_end = 0, 96

print("SPACEMAN_BUILD_OK")

if not LIVE:
    # ── Export (pas en mode direct) ─────────────────────────────────────────

    os.makedirs(os.path.dirname(OUT_RAW), exist_ok=True)
    arm.animation_data.action = None
    set_pose({})
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
    for o in (spaceman, camp, flame):
        o.data.materials.clear()
    bpy.ops.object.select_all(action="DESELECT")
    for o in (spaceman, arm, camp, flame):
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=OUT_RAW,
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_skins=True,
        export_materials="NONE",
        export_vertex_color="ACTIVE",
        export_active_vertex_color_when_no_material=True,
        export_texcoords=True,
        export_normals=True,
        export_yup=True,
        export_optimize_animation_size=True,
        export_draco_mesh_compression_enable=False,  # compression meshopt ensuite (npm run model)
    )
    print("SPACEMAN_EXPORT_OK", OUT_RAW)
