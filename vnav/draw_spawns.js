const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const config = {
  input: "map.png",
  output: "output.png",
  lineColor: "red",
  newLineColor: "blue",
  lineWidth: 2,
  circleStroke: "green",
  circleStrokeWidth: 2,
  circleFill: "rgba(0, 255, 0, 0.2)",
};


// Function to map world coords (x,z) to image coords
function mapToImage(x, z, dimension) {
  const max = dimension / 2;
  const min = -max;

  const normX = (x - min) / (max - min);
  const normZ = (z - min) / (max - min);

  const px = normX * dimension;
  const py = normZ * dimension;

  return [px, py];
}

function randomColor() {
  // Return a random RGB color string like "rgb(123,45,67)"
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);
  return `rgb(${r},${g},${b})`;
}

function randomColorPair() {
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);

  // Fill is semi-transparent
  const fill = `rgba(${r},${g},${b},0.3)`;

  // Stroke is darker (50% brightness), fully opaque
  const darkenFactor = 0.5;
  const dr = Math.floor(r * darkenFactor);
  const dg = Math.floor(g * darkenFactor);
  const db = Math.floor(b * darkenFactor);
  const stroke = `rgb(${dr},${dg},${db})`;

  return { fill, stroke };
}

// Parse CSV file into array of spawn objects
const parse = require('csv-parse');

function parseCSVStream(filePath) {
  return new Promise((resolve, reject) => {
    const records = [];
    fs.createReadStream(filePath)
      .pipe(parse.parse({ columns: true, trim: true }))
      .on("data", (record) => records.push(record))
      .on("end", () => resolve(records))
      .on("error", (err) => reject(err));
  });
}

async function drawConnectionsAndSpawns() {
  const image = sharp(config.input);
  const metadata = await image.metadata();
  const { width, height } = metadata;

  // Load and parse spawn CSV
  const spawns = await parseCSVStream("monster_spawns.csv");

  // Draw spawn circles
  // Note: We map only x and z coords, ignoring y (height)
  const circles = spawns.map(({ name, center, radius }) => {
    center = center.split(", ").map(Number);
    const [cx, cy] = mapToImage(parseFloat(center[0]), parseFloat(center[2]), width);

    const { fill, stroke } = randomColorPair();

  return `<circle cx="${cx}" cy="${cy}" r="${radius}" stroke="${stroke}" stroke-width="${config.circleStrokeWidth}" fill="${fill}" />`;  });


  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${circles.join("\n")}
    </svg>
  `;

  await image.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).toFile(config.output);

  console.log(`Saved to ${config.output}`);
}

drawConnectionsAndSpawns().catch(console.error);
