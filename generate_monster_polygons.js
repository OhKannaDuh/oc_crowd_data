const fs = require("fs");
const Database = require("better-sqlite3");

const db = new Database("oc_crowd_data.db");

const stmt = db.prepare(`
  SELECT 
    name,
    pos_x,
    pos_y,
    pos_z
  FROM monster_spawns
`);

const rows = stmt.all();

// Step 1: Group by name
const groups = {};
for (const row of rows) {
  if (!row.name.startsWith("Crescent")) continue;

  if (!groups[row.name]) groups[row.name] = [];
  groups[row.name].push([row.pos_x, row.pos_y, row.pos_z]);
}

function mapToImage(x, z, dimension) {
  const max = dimension / 2;
  const min = -max;

  const normX = (x - min) / (max - min);
  const normZ = (z - min) / (max - min);

  const px = normX * dimension;
  const py = normZ * dimension;

  return [px, py];
}

function cross(o, a, b) {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

// points: array of [x, y] 2D points
function convexHull(points) {
  points = points.slice().sort((a, b) => (a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]));
  const lower = [];
  for (const p of points) {
    while (lower.length >= 2 && cross(lower[lower.length-2], lower[lower.length-1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper = [];
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    while (upper.length >= 2 && cross(upper[upper.length-2], upper[upper.length-1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

// Step 2 & 3: Calculate center and radius
const polygons = [];

for (const [name, positions] of Object.entries(groups)) {
  // Project positions to 2D image coords (x,z)
  const points2D = positions.map(([x, y, z]) => {
    const [px, py] = mapToImage(x, z, width);
    return [px, py];
  });

  // Get polygon hull points
  const hullPoints = convexHull(points2D);

  // Create SVG polygon points string
  const pointsAttr = hullPoints.map(p => p.join(",")).join(" ");

  // Random fill and stroke (or your own logic)
  const fill = `rgba(0, 255, 0, 0.3)`;
  const stroke = `rgba(0, 128, 0, 0.8)`;

  polygons.push(`<polygon points="${pointsAttr}" fill="${fill}" stroke="${stroke}" stroke-width="2" />`);
}

const svg = `
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    ${polygons.join("\n")}
  </svg>
`;

async function main()
{
  await image.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).toFile(config.output);
}


main();