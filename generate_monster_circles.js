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

// Step 2 & 3: Calculate center and radius
const output = [["name", "center", "radius"]];

for (const [name, positions] of Object.entries(groups)) {
  // Center
  const center = positions
    .reduce((acc, [x, y, z]) => [acc[0] + x, acc[1] + y, acc[2] + z], [0, 0, 0])
    .map((sum) => sum / positions.length);

  // Radius (max distance from center)
  const radius = Math.max(
    ...positions.map(([x, y, z]) => {
      const dx = x - center[0];
      const dy = y - center[1];
      const dz = z - center[2];
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    })
  );

  output.push([
    name,
    `[${center.map((n) => n.toFixed(2)).join(", ")}]`,
    radius.toFixed(2),
  ]);
}

// Write to CSV
const csv = output.map((row) => row.join(",")).join("\n");
fs.writeFileSync("monster_circles.csv", csv);
