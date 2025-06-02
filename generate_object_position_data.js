const fs = require("fs");
const Database = require("better-sqlite3");

const db = new Database("oc_crowd_data.db");

// Tolerance in position to consider two points "the same"
const POSITION_EPSILON = 0.05;

const stmt = db.prepare(`
  SELECT 
    type,
    model_id,
    pos_x,
    pos_y,
    pos_z,
    COUNT(*) as count
  FROM object_positions
  GROUP BY type, model_id, pos_x, pos_y, pos_z
  ORDER BY type, model_id, pos_x, pos_y, pos_z
`);

const type_to_name = {
  1: "Treasure",
  2: "Carrot",
};

const rows = stmt.all();

function isClose(pos1, pos2, epsilon = POSITION_EPSILON) {
  return (
    Math.abs(pos1.x - pos2.x) <= epsilon &&
    Math.abs(pos1.y - pos2.y) <= epsilon &&
    Math.abs(pos1.z - pos2.z) <= epsilon
  );
}

const groupedByTypeAndModel = {};

// Group similar positions per type and model_id
for (const row of rows) {
  const { type, model_id, pos_x, pos_y, pos_z, count } = row;
  const typeName = type_to_name[type] || `Unknown (${type})`;
  const modelIdName = model_id !== null ? model_id.toString() : "No Model";

  const groupKey = `${typeName} | Model ID: ${modelIdName}`;
  if (!groupedByTypeAndModel[groupKey]) groupedByTypeAndModel[groupKey] = [];

  const newPos = { x: pos_x, y: pos_y, z: pos_z };
  let merged = false;

  for (const existing of groupedByTypeAndModel[groupKey]) {
    if (isClose(existing.position, newPos)) {
      existing.count += count;
      merged = true;
      break;
    }
  }

  if (!merged) {
    groupedByTypeAndModel[groupKey].push({
      position: newPos,
      count,
    });
  }
}

// Build CSV
let csv = ["type,model_id,submissions,x,y,z"];

for (const [groupKey, entries] of Object.entries(groupedByTypeAndModel)) {
  for (const entry of entries) {
    const { position, count } = entry;
    // Split groupKey back into type and model_id columns for CSV clarity
    const [typeName, modelIdPart] = groupKey.split(" | ");
    const modelIdValue = modelIdPart.replace("Model ID: ", "");

    csv.push(
      `"${typeName}",${modelIdValue},${count},${position.x.toFixed(
        2
      )},${position.y.toFixed(2)},${position.z.toFixed(2)}`
    );
  }
}

fs.writeFileSync("object_position_data.csv", csv.join("\n"));
console.log(csv);
console.log(
  "CSV with grouped positions written to 'object_position_data.csv'."
);
