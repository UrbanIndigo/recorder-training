// Anatomy for the Learn mode: the major surface muscles (front and back)
// and the main bones, each with a short note on what it does, drawn on a
// simple body diagram. Shapes are given for the left half of the picture
// and mirrored, unless they sit on the midline. Coordinates are in a
// 200 × 440 box. No DOM code.

// --------------------------------------------------------------- muscles

/** Muscles: shapes per view ('front' / 'back'), and what each one does. */
export const MUSCLES = [
  {
    id: 'scm', name: 'Sternocleidomastoid', aka: ['SCM'],
    fact: 'Turns the head to the opposite side and bends the neck forward.',
    front: [[[89, 52], [93, 52], [99, 72], [95, 73]]],
  },
  {
    id: 'trapezius', name: 'Trapezius', aka: ['traps', 'trap'],
    fact: 'Moves and steadies the shoulder blades: shrugging, squeezing them together; also tilts the head back.',
    front: [[[89, 60], [90, 68], [70, 77], [60, 81], [72, 72]]],
    back: [[[100, 50], [91, 54], [88, 66], [70, 75], [60, 81], [64, 86], [80, 90], [92, 120], [100, 164]]],
  },
  {
    id: 'deltoid', name: 'Deltoid', aka: ['delts', 'delt', 'deltoids'],
    fact: 'Lifts the arm out to the side; its front and back parts also swing the arm forward and back.',
    front: [[[66, 80], [56, 82], [48, 90], [45, 104], [45, 118], [50, 122], [55, 106], [62, 92]]],
    back: [[[66, 80], [56, 82], [48, 90], [45, 104], [45, 118], [50, 122], [55, 106], [62, 92]]],
  },
  {
    id: 'pectoralis', name: 'Pectoralis major', aka: ['pecs', 'pec', 'pectoral', 'pectoralis'],
    fact: 'Pulls the arm across the body and forward, and rotates it inwards (pushing, hugging).',
    front: [[[99, 80], [84, 78], [68, 82], [61, 92], [60, 108], [66, 118], [80, 123], [99, 122]]],
  },
  {
    id: 'biceps', name: 'Biceps brachii', aka: ['biceps', 'bicep'],
    fact: 'Bends the elbow and turns the palm up (supination).',
    front: [[[53, 122], [48, 134], [46, 154], [50, 170], [55, 156], [58, 134]]],
  },
  {
    id: 'brachioradialis', name: 'Brachioradialis', aka: [],
    fact: 'Bends the elbow, strongest with the thumb pointing up (as in a hammer curl).',
    front: [[[41, 176], [37, 198], [34, 226], [38, 230], [43, 204], [48, 180]]],
  },
  {
    id: 'flexors', name: 'Wrist flexors', aka: ['forearm flexors', 'flexors'],
    fact: 'Bend the wrist and fingers (gripping); they start from the inner side of the elbow.',
    front: [[[49, 182], [44, 206], [40, 232], [44, 236], [49, 210], [54, 184]]],
  },
  {
    id: 'serratus', name: 'Serratus anterior', aka: ['serratus'],
    fact: 'Pulls the shoulder blade forward around the ribs, as in a punch: the "boxer’s muscle".',
    front: [[[64, 122], [62, 134], [64, 146], [70, 150], [72, 130]]],
  },
  {
    id: 'obliques', name: 'External oblique', aka: ['obliques', 'oblique', 'external obliques'],
    fact: 'Twists and bends the trunk to the side, and squeezes the belly.',
    front: [[[72, 124], [86, 128], [87, 170], [90, 206], [76, 204], [70, 180], [68, 152], [70, 132]]],
  },
  {
    id: 'rectus_abdominis', name: 'Rectus abdominis', aka: ['abs', 'six pack', 'abdominals'],
    fact: 'Bends the trunk forward (sitting up); the "six-pack".',
    front: [[[88, 126], [99, 126], [99, 206], [91, 206], [87, 168]]],
  },
  {
    id: 'tfl', name: 'Tensor fasciae latae', aka: ['TFL'],
    fact: 'Helps lift the thigh and move it outwards, and tightens the iliotibial (IT) band.',
    front: [[[64, 232], [70, 230], [72, 258], [66, 262]]],
  },
  {
    id: 'vastus_lateralis', name: 'Vastus lateralis', aka: [],
    fact: 'Straightens the knee; the biggest of the four quadriceps muscles, on the outside of the thigh.',
    front: [[[66, 256], [74, 252], [74, 290], [78, 316], [72, 326], [68, 304], [65, 280]]],
  },
  {
    id: 'rectus_femoris', name: 'Rectus femoris', aka: [],
    fact: 'Straightens the knee and helps lift the thigh; the only quadriceps muscle that crosses the hip.',
    front: [[[76, 246], [84, 242], [90, 258], [90, 300], [85, 320], [79, 312], [75, 284]]],
  },
  {
    id: 'vastus_medialis', name: 'Vastus medialis', aka: ['teardrop'],
    fact: 'Straightens the knee; the "teardrop" quadriceps muscle just above the inside of the knee.',
    front: [[[89, 290], [95, 298], [95, 322], [88, 328], [85, 316], [88, 304]]],
  },
  {
    id: 'adductors', name: 'Adductors', aka: ['adductor', 'groin', 'inner thigh'],
    fact: 'Pull the thigh in towards the other leg (and steady the hip).',
    front: [[[90, 254], [99, 258], [98, 280], [94, 300], [90, 290], [88, 270]]],
  },
  {
    id: 'sartorius', name: 'Sartorius', aka: [],
    fact: 'The longest muscle in the body: helps bend, lift and turn out the thigh and bend the knee, as when sitting cross-legged.',
    front: [[[66, 236], [71, 233], [85, 272], [96, 320], [93, 330], [81, 280]]],
  },
  {
    id: 'tibialis', name: 'Tibialis anterior', aka: ['tibialis', 'shin muscle'],
    fact: 'Lifts the front of the foot (dorsiflexion) and turns the sole inwards.',
    front: [[[75, 342], [81, 340], [84, 370], [83, 404], [80, 410], [77, 380]]],
  },
  {
    id: 'fibularis', name: 'Fibularis longus', aka: ['peroneus longus', 'peroneals', 'fibularis'],
    fact: 'Points the foot and turns the sole outwards; on the outside of the lower leg.',
    front: [[[69, 344], [74, 344], [76, 378], [77, 404], [73, 398], [70, 372]]],
  },
  {
    id: 'infraspinatus', name: 'Infraspinatus', aka: [],
    fact: 'Rotates the arm outwards; one of the four rotator cuff muscles that hold the shoulder joint together.',
    back: [[[80, 94], [68, 98], [64, 112], [74, 122], [86, 112]]],
  },
  {
    id: 'teres_major', name: 'Teres major', aka: [],
    fact: 'Pulls the arm down and back and rotates it inwards, helping the latissimus dorsi.',
    back: [[[66, 121], [64, 128], [78, 134], [82, 126]]],
  },
  {
    id: 'latissimus', name: 'Latissimus dorsi', aka: ['lats', 'lat'],
    fact: 'Pulls the arm down and back (pull-ups, rowing); the widest muscle of the back.',
    back: [[[88, 124], [82, 130], [68, 132], [65, 150], [68, 176], [76, 198], [90, 214], [99, 216], [99, 176], [93, 154]]],
  },
  {
    id: 'erector', name: 'Erector spinae', aka: ['erectors', 'spinal erectors'],
    fact: 'Straightens and arches the back and keeps you upright; runs either side of the spine.',
    back: [[[93, 150], [99, 152], [99, 232], [93, 232], [91, 190]]],
  },
  {
    id: 'triceps', name: 'Triceps brachii', aka: ['triceps', 'tricep'],
    fact: 'Straightens the elbow (pushing, throwing).',
    back: [[[56, 120], [47, 132], [44, 160], [48, 176], [55, 162], [59, 136]]],
  },
  {
    id: 'extensors', name: 'Wrist extensors', aka: ['forearm extensors', 'extensors'],
    fact: 'Straighten the wrist and fingers and cock the wrist back; they start from the outer side of the elbow.',
    back: [[[40, 178], [35, 204], [33, 232], [38, 236], [44, 208], [50, 182]]],
  },
  {
    id: 'glute_med', name: 'Gluteus medius', aka: ['glute medius'],
    fact: 'Moves the thigh out to the side and keeps the hips level as you walk.',
    back: [[[66, 212], [84, 208], [90, 220], [80, 230], [66, 232]]],
  },
  {
    id: 'glute_max', name: 'Gluteus maximus', aka: ['glutes', 'glute', 'glute max', 'bum'],
    fact: 'Straightens the hip (standing up, climbing stairs, running); the largest muscle in the body.',
    back: [[[66, 234], [82, 226], [99, 232], [99, 262], [86, 270], [70, 264], [64, 250]]],
  },
  {
    id: 'biceps_femoris', name: 'Biceps femoris', aka: [],
    fact: 'Bends the knee and straightens the hip; the outer hamstring.',
    back: [[[66, 268], [78, 272], [80, 300], [78, 326], [72, 324], [68, 300]]],
  },
  {
    id: 'semitendinosus', name: 'Semitendinosus', aka: [],
    fact: 'Bends the knee and straightens the hip; an inner hamstring.',
    back: [[[80, 272], [95, 266], [96, 296], [92, 322], [84, 324], [82, 300]]],
  },
  {
    id: 'gastrocnemius', name: 'Gastrocnemius', aka: ['calf', 'calves', 'gastroc'],
    fact: 'Points the foot (rising on tiptoe) and helps bend the knee; the bulge of the calf.',
    back: [[[71, 336], [83, 334], [94, 336], [95, 360], [90, 380], [83, 370], [77, 380], [70, 360]]],
  },
  {
    id: 'soleus', name: 'Soleus', aka: [],
    fact: 'Points the foot; works hard keeping you steady when standing and walking. Lies under the gastrocnemius.',
    back: [[[70, 364], [76, 382], [83, 372], [90, 382], [95, 364], [94, 396], [86, 404], [78, 404], [73, 392]]],
  },
  {
    id: 'achilles', name: 'Achilles tendon', aka: ['calcaneal tendon', 'achilles'],
    fact: 'The strongest tendon in the body: joins the calf muscles to the heel bone.',
    back: [[[82, 400], [87, 400], [87, 418], [82, 418]]],
  },
];

// ----------------------------------------------------------------- bones

const ellipse = (cx, cy, rx, ry, n = 14) => Array.from({ length: n }, (_, i) => [cx + rx * Math.cos((2 * Math.PI * i) / n), cy + ry * Math.sin((2 * Math.PI * i) / n)]);

/** Bones, front view. `mid` shapes sit on the midline and aren't mirrored. */
export const BONES = [
  { id: 'skull', name: 'Skull (cranium)', aka: ['skull', 'cranium'], fact: 'Protects the brain; the cranium is 8 bones joined at wavy seams called sutures.', mid: true, skeleton: [ellipse(100, 29, 17, 21, 16)] },
  { id: 'mandible', name: 'Mandible', aka: ['jaw', 'jawbone', 'jaw bone'], fact: 'The jawbone: the only bone of the skull that moves.', mid: true, skeleton: [[[86, 40], [91, 52], [100, 57], [109, 52], [114, 40], [108, 47], [100, 50], [92, 47]]] },
  // Drawn first: from the front, the spine is behind the ribcage and breastbone.
  { id: 'spine', name: 'Vertebral column', aka: ['spine', 'backbone', 'spinal column', 'vertebrae'], fact: 'The spine: 7 neck, 12 chest and 5 lower-back vertebrae plus the fused sacrum and coccyx; it protects the spinal cord.', mid: true, straight: true, skeleton: [[[97.5, 56], [102.5, 56], [102.5, 210], [97.5, 210]]] },
  { id: 'clavicle', name: 'Clavicle', aka: ['collarbone', 'collar bone'], fact: 'The collarbone: braces the shoulder out from the chest; one of the most often broken bones.', skeleton: [[[97, 72], [84, 73], [66, 78], [64, 82], [84, 78], [97, 77]]] },
  { id: 'sternum', name: 'Sternum', aka: ['breastbone', 'breast bone'], fact: 'The breastbone: most of the ribs attach to it by cartilage.', mid: true, skeleton: [[[96, 80], [104, 80], [103.5, 124], [100, 132], [96.5, 124]]] },
  { id: 'ribs', name: 'Ribs', aka: ['ribcage', 'rib cage', 'rib'], fact: '12 pairs, protecting the heart and lungs; the lowest two pairs are "floating ribs", not joined at the front.', skeleton: [[[95, 82], [78, 85], [67, 96], [64, 116], [66, 138], [74, 152], [90, 156], [95, 148]]] },
  { id: 'humerus', name: 'Humerus', aka: ['upper arm bone'], fact: 'The upper arm bone; the "funny bone" is really a nerve passing its elbow end.', skeleton: [[[62, 86], [56, 88], [53, 100], [50, 140], [46, 168], [51, 173], [56, 166], [55, 140], [59, 104], [64, 96]]] },
  { id: 'radius', name: 'Radius', aka: [], fact: 'Forearm bone on the thumb side; it rolls around the ulna to turn the palm over.', skeleton: [[[41, 180], [36, 210], [33, 246], [37, 248], [41, 214], [46, 182]]] },
  { id: 'ulna', name: 'Ulna', aka: [], fact: 'Forearm bone on the little-finger side; its end forms the point of the elbow.', skeleton: [[[49, 180], [45, 212], [41, 246], [45, 248], [50, 214], [55, 182]]] },
  { id: 'carpals', name: 'Carpals', aka: ['wrist bones'], fact: 'The 8 small bones of the wrist.', skeleton: [[[31, 250], [44, 250], [44, 259], [30, 259]]] },
  { id: 'metacarpals', name: 'Metacarpals', aka: ['palm bones'], fact: 'The 5 bones of the palm.', skeleton: [[[29, 261], [44, 261], [42, 274], [30, 274]]] },
  { id: 'phalanges_hand', name: 'Phalanges (fingers)', aka: ['phalanges', 'finger bones'], fact: '14 finger bones in each hand: 3 in each finger and 2 in the thumb.', skeleton: [[[30, 276], [42, 276], [39, 290], [32, 290]]] },
  { id: 'pelvis', name: 'Pelvis', aka: ['hip bone', 'hip bones', 'pelvic bone'], fact: 'The hip bones: they carry the weight of the upper body to the legs and hold the hip sockets.', skeleton: [[[92, 206], [76, 204], [64, 212], [64, 230], [74, 244], [88, 250], [96, 248], [94, 236], [84, 232], [80, 222], [92, 218]]] },
  { id: 'sacrum', name: 'Sacrum', aka: [], fact: '5 vertebrae fused into one triangular bone at the base of the spine, wedged between the hip bones.', mid: true, skeleton: [[[94, 212], [106, 212], [104, 236], [100, 242], [96, 236]]] },
  { id: 'femur', name: 'Femur', aka: ['thigh bone', 'thighbone'], fact: 'The thigh bone: the longest and strongest bone in the body.', skeleton: [[[70, 238], [78, 234], [84, 244], [86, 280], [88, 322], [91, 330], [79, 331], [80, 322], [78, 280], [76, 250]]] },
  { id: 'patella', name: 'Patella', aka: ['kneecap', 'knee cap'], fact: 'The kneecap: sits in the tendon of the quadriceps and gives it better leverage.', skeleton: [ellipse(85, 335, 5, 6, 10)] },
  { id: 'tibia', name: 'Tibia', aka: ['shinbone', 'shin bone', 'shin'], fact: 'The shinbone: the main weight-bearing bone of the lower leg.', skeleton: [[[83, 342], [94, 341], [92, 370], [91, 412], [85, 414], [86, 370]]] },
  { id: 'fibula', name: 'Fibula', aka: [], fact: 'The thin bone on the outside of the lower leg: mostly for muscle attachments and steadying the ankle.', skeleton: [[[72, 344], [77, 344], [78, 380], [79, 412], [75, 412], [74, 380]]] },
  { id: 'tarsals', name: 'Tarsals', aka: ['ankle bones', 'calcaneus', 'heel bone'], fact: 'The 7 ankle bones, including the heel bone (calcaneus).', skeleton: [[[75, 414], [93, 414], [94, 424], [74, 424]]] },
  { id: 'metatarsals', name: 'Metatarsals', aka: [], fact: 'The 5 long bones of the foot.', skeleton: [[[72, 425], [95, 425], [97, 431], [71, 431]]] },
  { id: 'phalanges_foot', name: 'Phalanges (toes)', aka: ['toe bones'], fact: '14 toe bones in each foot: 3 in each toe and 2 in the big toe.', skeleton: [[[71, 432], [97, 432], [96, 437], [73, 437]]] },
];

// --------------------------------------------------------------- drawing

/** The body's outline, left half (from the neck down the outside, back up the inside of the leg). */
const LEFT_OUTLINE = [
  [100, 66], [90, 66], [84, 70], [70, 76], [58, 80], [50, 86], [46, 98], [44, 118], [42, 140], [40, 160], [38, 176], [35, 196],
  [33, 216], [31, 236], [30, 250], [27, 258], [25, 272], [27, 284], [33, 290], [39, 286], [42, 274], [43, 262], [42, 252], [45, 232],
  [48, 214], [52, 196], [55, 180], [57, 160], [60, 140], [62, 122], [64, 112], [65, 130], [66, 150], [68, 172], [70, 192], [66, 212],
  [63, 232], [63, 256], [65, 280], [68, 306], [70, 330], [69, 350], [70, 372], [74, 396], [77, 418], [72, 428], [74, 436], [94, 437],
  [96, 428], [93, 418], [94, 396], [95, 372], [95, 350], [95, 330], [96, 306], [98, 282], [99, 262], [100, 254],
];

const mirror = (pts) => pts.map(([x, y]) => [200 - x, y]);
const f = (n) => Math.round(n * 10) / 10;

/** A smooth closed curve through the points (Catmull–Rom turned into Béziers). */
export function smoothPath(pts) {
  const n = pts.length;
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d}Z`;
}

const OUTLINE = smoothPath([...LEFT_OUTLINE, ...mirror(LEFT_OUTLINE).reverse()]);

/** Items drawn in a view: 'front' / 'back' (muscles) or 'skeleton' (bones). */
export function itemsInView(view) {
  return (view === 'skeleton' ? BONES : MUSCLES).filter((it) => it[view]);
}

/** The views an item appears in. */
export const viewsOf = (it) => ['front', 'back', 'skeleton'].filter((v) => it[v]);

/**
 * The diagram as SVG. `highlight`: an item id to light up; `marks`: id ->
 * 'right' | 'wrong' for feedback. Each shape carries data-id for tapping.
 */
export function bodySvg(view, { highlight = null, marks = {}, labels = false } = {}) {
  const items = itemsInView(view);
  const parts = [];
  parts.push(`<path class="an-skin" d="${OUTLINE}"/>`);
  parts.push('<ellipse class="an-skin" cx="100" cy="34" rx="19" ry="24"/><rect class="an-skin" x="89" y="50" width="22" height="20" rx="4"/>');
  if (view === 'skeleton') parts.push('<path class="an-faint" d="M97.5 64h5M97.5 76h5M97.5 88h5M97.5 100h5M97.5 112h5M97.5 124h5M97.5 136h5M97.5 148h5M97.5 160h5M97.5 172h5M97.5 184h5M97.5 196h5"/>');
  for (const it of items) {
    const cls = `an-part${it.id === highlight ? ' an-hi' : ''}${marks[it.id] ? ` an-${marks[it.id]}` : ''}`;
    const shapes = it[view].flatMap((pts) => (it.mid ? [pts] : [pts, mirror(pts)]));
    // Long thin straight shapes (the spine) keep straight edges: smoothing would bulge their ends.
    const path = (pts) => (it.straight ? `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z` : smoothPath(pts));
    parts.push(`<g class="${cls}" data-id="${it.id}">${shapes.map((pts) => `<path d="${path(pts)}"/>`).join('')}</g>`);
  }
  if (view === 'skeleton') {
    // Rib lines over the ribcage, for the look of it.
    const ribs = [];
    for (let k = 0; k < 7; k++) {
      const y = 92 + k * 8.5;
      ribs.push(`M96 ${y}Q${78 - k} ${y - 4} ${68 + k * 0.6} ${y + 9}`, `M104 ${y}Q${122 + k} ${y - 4} ${132 - k * 0.6} ${y + 9}`);
    }
    parts.push(`<path class="an-ribline" d="${ribs.join('')}"/>`);
  }
  if (view === 'front') parts.push('<path class="an-line" d="M89 146h20M89 164h20M90 184h19M99.5 128v76"/>');
  if (labels) {
    for (const it of items) {
      const pts = it[view][0];
      const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
      const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
      parts.push(`<text class="an-label" x="${f(cx)}" y="${f(cy)}">${it.name}</text>`);
    }
  }
  const title = { front: 'Front', back: 'Back', skeleton: 'Skeleton' }[view];
  return `<svg class="an-svg" viewBox="0 0 200 444" role="img" aria-label="${title} of the body">${parts.join('')}</svg>`;
}
