const sharp = require("sharp");
const Database = require("better-sqlite3");

const config = {
  input: "map.png",
  output: "output.png",
  polygonStrokeWidth: 2,
  polygonFillAlpha: 0.3,
  polygonStrokeAlpha: 0.8,
};

const monster_levels = {
    "Animated Doll": 5,
    "Arcapetrified Netzach": 26,
    "Crescent Aetherscab": 12,
    "Crescent Apa": 23,
    "Crescent Armor": "1-15",
    "Crescent Bachelor": 17,
    "Crescent Bandersnatch": 1,
    "Crescent Blackguard": 16,
    "Crescent Blood Demon": 15,
    "Crescent Bomb": "5-28",
    "Crescent Brachiosaur": 10,
    "Crescent Byblos": 13,
    "Crescent Caoineag": "6-22",
    "Crescent Catoblepas": 9,
    "Crescent Cetus": 7,
    "Crescent Chaochu": 2,
    "Crescent Chimera": 26,
    "Crescent Claw": 19,
    "Crescent Collagen": 19,
    "Crescent Demon Pawn": 17,
    "Crescent Dhruva": "5-28",
    "Crescent Diplocaulus": 18,
    "Crescent Dirty Eye": 21,
    "Crescent Dullahan": "26-28",
    "Crescent Echos": 14,
    "Crescent Fan": 5,
    "Crescent Flame": 22,
    "Crescent Flying Lizard": 1,
    "Crescent Foobar": 25,
    "Crescent Fool": "20-28",
    "Crescent Foper": 11,
    "Crescent Gaelicat": 2,
    "Crescent Garula": 1,
    "Crescent Geshunpest": 12,
    "Crescent Ghost": "4-20",
    "Crescent Golem": 8,
    "Crescent Goobbue": 6,
    "Crescent Gourmand": "18-20",
    "Crescent Haagenti": 24,
    "Crescent Harpuia": 11,
    "Crescent Headstone": 16,
    "Crescent Inkstain": 20,
    "Crescent Karlabos": 6,
    "Crescent Leshy": 3,
    "Crescent Lion Statant": 20,
    "Crescent Marolith": 4,
    "Crescent Meraevis": 9,
    "Crescent Mimic": "5-28",
    "Crescent Monk": 15,
    "Crescent Mousse": "5-28",
    "Crescent Panther": 14,
    "Crescent Petalodite": 7,
    "Crescent Rosebear": 11,
    "Crescent Satana": 27,
    "Crescent Snapweed": 3,
    "Crescent Taurus": 12,
    "Crescent Tormentor": 4,
    "Crescent Triceratops": 10,
    "Crescent Troubadour": 17,
    "Crescent Uragnite": 8,
    "Crescent Void Viper": 18,
    "Crescent Zaghnal": 22,
    "Crescent Zangbeto": 25,
    "Crescent Zaratan": 23,
    "Crescent Zirnitra": 28,
    "Lesser Cry of Havoc": 24,
    "Menacing Dahak": 13,
    "Occult Golem": 27,
    "Occult Isleblazer": 28,
    "Occult Sculpture": 21,
}


const blacklist_filter = [
  "Armor",
  "Bomb",
  "Caoineag",
  "Dhruva",
  "Dullahan",
  "Echos",
  "Fool",
  "Geshunpest",
  "Ghost",
  "Gourmand",
  "Mimic",
  "Mousse",
  "Troubadour",
];

// Map world coords (x,z) to image coords (pixels)
function mapToImage(x, z, dimension) {
  const max = dimension / 2;
  const min = -max;

  const normX = (x - min) / (max - min);
  const normZ = (z - min) / (max - min);

  const px = normX * dimension;
  const py = normZ * dimension;

  return [px, py];
}

// Cross product helper for convex hull
function cross(o, a, b) {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

// Compute convex hull with Monotone Chain algorithm
function convexHull(points) {
  points = points.slice().sort((a, b) =>
    a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]
  );
  const lower = [];
  for (const p of points) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper = [];
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

function clusterPoints(points, threshold) {
  const clusters = [];
  const visited = new Set();

  function distance(a, b) {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  for (let i = 0; i < points.length; i++) {
    if (visited.has(i)) continue;

    const cluster = [];
    const queue = [i];
    visited.add(i);

    while (queue.length) {
      const idx = queue.pop();
      const p = points[idx];
      cluster.push(p);

      // Look for neighbors within threshold
      for (let j = 0; j < points.length; j++) {
        if (!visited.has(j) && distance(p, points[j]) <= threshold) {
          visited.add(j);
          queue.push(j);
        }
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

async function main() {
  const db = new Database("../oc_crowd_data.db");
  const stmt = db.prepare(`
    SELECT name, pos_x, pos_y, pos_z FROM monster_spawns
  `);
  const rows = stmt.all();

  // Group positions by spawn name, filter for Crescent spawns
  const groups = {};
  for (const row of rows) {
    if (!row.name.startsWith("Crescent")) continue;
    if (blacklist_filter.some(term => row.name.includes(term))) continue;

    if (!groups[row.name]) groups[row.name] = [];
    groups[row.name].push([row.pos_x, row.pos_y, row.pos_z]);
  }

  const image = sharp(config.input);
  const metadata = await image.metadata();
  const { width, height } = metadata;

  // Generate polygons for each group
  const polygons = [];

const distanceThreshold = 128; // Adjust this to fit your world scale

for (const [name, positions] of Object.entries(groups)) {
  // Project positions to 2D (image space)
  if(positions.y <= -50) continue

  const points2D = positions.map(([x, y, z]) => mapToImage(x, z, width));

  // Cluster points by proximity
  const clusters = clusterPoints(points2D, distanceThreshold);

  for (const cluster of clusters) {
    if (cluster.length < 3) continue; // Need 3+ points for polygon

    const hullPoints = convexHull(cluster);
    const pointsAttr = hullPoints.map(p => p.join(",")).join(" ");

    // Random fill and stroke color per cluster (optional: use consistent color per name)
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);

    const fill = `rgba(${r},${g},${b},${config.polygonFillAlpha})`;
    const stroke = `rgba(${Math.floor(r / 2)},${Math.floor(g / 2)},${Math.floor(b / 2)},${config.polygonStrokeAlpha})`;

    const level = monster_levels[name] || 99;

        const centroid = hullPoints.reduce(
      (acc, p) => [acc[0] + p[0], acc[1] + p[1]],
      [0, 0]
    ).map(c => c / hullPoints.length);

    polygons.push(`<polygon points="${pointsAttr}" fill="${fill}" stroke="${stroke}" stroke-width="${config.polygonStrokeWidth}" />`);
        polygons.push(
      `<text x="${centroid[0]}" y="${centroid[1]}" text-anchor="middle" dominant-baseline="central" fill="black" font-size="32" font-family="Arial">${level}</text>`
    );
  }
}

  // Create SVG overlay
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${polygons.join("\n")}
    </svg>
  `;

  // Composite polygons onto base image
  await image
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .toFile(config.output);

  console.log(`Saved image with polygons to ${config.output}`);
}

main().catch(console.error);
