const fs = require("fs");
const Database = require("better-sqlite3");

const db = new Database("oc_crowd_data.db");

// Tolerance in position to consider two points "the same"
const POSITION_EPSILON = 0.05;

const stmt = db.prepare(`
  SELECT 
    type,
    pos_x,
    pos_y,
    pos_z,
    COUNT(*) as count
  FROM data
  GROUP BY type, pos_x, pos_y, pos_z
  ORDER BY type, pos_x, pos_y, pos_z
`);

const type_to_name = {
  1: "Bronze Coffer",
  2: "Silver Coffer",
  3: "Carrot",
};

const rows = stmt.all();

function isClose(pos1, pos2, epsilon = POSITION_EPSILON) {
  return (
    Math.abs(pos1.x - pos2.x) <= epsilon &&
    Math.abs(pos1.y - pos2.y) <= epsilon &&
    Math.abs(pos1.z - pos2.z) <= epsilon
  );
}

const groupedByType = {};

// Group similar positions per type
for (const row of rows) {
  const { type, pos_x, pos_y, pos_z, count } = row;
  const name = type_to_name[type] || `Unknown (${type})`;

  if (!groupedByType[name]) groupedByType[name] = [];

  const newPos = { x: pos_x, y: pos_y, z: pos_z };
  let merged = false;

  for (const existing of groupedByType[name]) {
    if (isClose(existing.position, newPos)) {
      existing.count += count;
      merged = true;
      break;
    }
  }

  if (!merged) {
    groupedByType[name].push({
      position: newPos,
      count,
    });
  }
}

// Build CSV
let csv = ["type,submissions,x,y,z"];

for (const [name, entries] of Object.entries(groupedByType)) {
  for (const entry of entries) {
    const { position, count } = entry;
    csv.push(
      `"${name}",${count},${position.x.toFixed(2)},${position.y.toFixed(
        2
      )},${position.z.toFixed(2)}`
    );
  }
}

fs.writeFileSync("object_position_data.csv", csv.join("\n"));
console.log(csv);
console.log("CSV with grouped positions written to 'output.csv'.");
