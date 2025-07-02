const fs = require("fs");
const Database = require("better-sqlite3");

const db = new Database("oc_crowd_data.db");

// Tolerance to consider two positions "the same"
const POSITION_EPSILON = 0.05;

const stmt = db.prepare(`
  SELECT 
    name,
    pos_x,
    pos_y,
    pos_z,
    COUNT(*) as count
  FROM monster_spawns
  GROUP BY name, pos_x, pos_y, pos_z
  ORDER BY name, pos_x, pos_y, pos_z
`);

const rows = stmt.all();

function isClose(pos1, pos2, epsilon = POSITION_EPSILON) {
  return (
    Math.abs(pos1.x - pos2.x) <= epsilon &&
    Math.abs(pos1.y - pos2.y) <= epsilon &&
    Math.abs(pos1.z - pos2.z) <= epsilon
  );
}

const groupedByName = {};

for (const row of rows) {
  if (!row.name.startsWith("Crescent")) continue;

  const { name, pos_x, pos_y, pos_z, count } = row;
  if (!groupedByName[name]) groupedByName[name] = [];

  const newPos = { x: pos_x, y: pos_y, z: pos_z };
  let merged = false;

  for (const existing of groupedByName[name]) {
    if (isClose(existing.position, newPos)) {
      existing.count += count;
      merged = true;
      break;
    }
  }

  if (!merged) {
    groupedByName[name].push({
      position: newPos,
      count,
    });
  }
}

// Build CSV
let csv = ["name,submissions,x,y,z"];

for (const [name, entries] of Object.entries(groupedByName)) {
  if (!name.startsWith("Crescent")) continue;
  for (const entry of entries) {
    const { position, count } = entry;
    csv.push(
      `"${name}",${count},${position.x.toFixed(2)},${position.y.toFixed(
        2
      )},${position.z.toFixed(2)}`
    );
  }
}

fs.writeFileSync("monster_spawn_data.csv", csv.join("\n"));
console.log(csv);
console.log(
  "CSV with grouped monster spawns written to 'monster_spawn_data.csv'."
);
