import { get_pixel_data } from "./get_pixel_data.js";
import PF from "pathfinding";
import sharp from "sharp";
import fs from "fs";

const nodes = JSON.parse(fs.readFileSync("nodes.json").toString());

function isRed(pixel) {
  const [r, g, b] = pixel;
  return r > 150 && g < 100 && b < 100;
}

function chunkArray(arr, chunkSize) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    chunks.push(arr.slice(i, i + chunkSize));
  }
  return chunks;
}

function worldToPixel(x, z, width, height) {
  const px = Math.round(x + width / 2);
  const py = Math.round(z + height / 2);
  return [px, py];
}

function getNearbyPixels(x, y, radius, width, height) {
  const pixels = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (
        nx >= 0 &&
        ny >= 0 &&
        nx < width &&
        ny < height &&
        dx * dx + dy * dy <= radius * radius
      ) {
        pixels.push([nx, ny]);
      }
    }
  }
  return pixels;
}

async function main() {
  console.log("Reading map and generating walkable grid...");

  const map = [];
  const { pixels, info } = await get_pixel_data("southhorn.png");

  for (const data of pixels) {
    map.push(isRed(data.pixel) ? 1 : 0);
  }

  const pixelBuffer = Buffer.alloc(map.length * 3);
  for (let i = 0; i < map.length; i++) {
    const color = map[i] === 1 ? 0 : 255;
    pixelBuffer[i * 3 + 0] = color;
    pixelBuffer[i * 3 + 1] = color;
    pixelBuffer[i * 3 + 2] = color;
  }

  await sharp(pixelBuffer, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 3,
    },
  })
    .png()
    .toFile("collision_mask.png");

  console.log("Collision mask saved as collision_mask.png");

  const grid = chunkArray(map, info.width);
  const walkableGrid = grid.map((row) =>
    row.map((cell) => (cell === 1 ? 1 : 0))
  );
  const gridInstance = new PF.Grid(walkableGrid);
  const finder = new PF.AStarFinder();

  console.log(`Loaded ${nodes.length} nodes. Computing pairwise paths...`);

  // Here...
  const radius = 100;
  const totalPairs = (nodes.length * (nodes.length - 1)) / 2;
  let pairCount = 0;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      pairCount++;
      console.log(
        `Computing path for node pair ${pairCount} of ${totalPairs} (nodes ${i} -> ${j})`
      );

      const [x1, y1] = worldToPixel(
        nodes[i].x,
        nodes[i].z,
        info.width,
        info.height
      );
      const [x2, y2] = worldToPixel(
        nodes[j].x,
        nodes[j].z,
        info.width,
        info.height
      );

      const nearbyA = getNearbyPixels(x1, y1, radius, info.width, info.height);
      const nearbyB = getNearbyPixels(x2, y2, radius, info.width, info.height);

      let shortestPath = null;
      let shortestCost = Infinity;
      let attempts = 0;

      for (const [startX, startY] of nearbyA) {
        for (const [endX, endY] of nearbyB) {
          attempts++;
          // Optionally, log progress every 1000 attempts to avoid flooding the console
          // if (attempts % 1000 === 0) {
          console.log(
            `  Tried ${attempts} start-end pixel pairs for node pair ${i}-${j}...`
          );
          // }

          const gridClone = gridInstance.clone();
          const path = finder.findPath(startX, startY, endX, endY, gridClone);

          if (path.length > 0 && path.length < shortestCost) {
            shortestCost = path.length;
            shortestPath = path;
          }
        }
      }

      if (!shortestPath) {
        console.log(`No path found between node ${i} and node ${j}`);
        distances[`${i},${j}`] = Infinity;
        distances[`${j},${i}`] = Infinity;
        paths[`${i},${j}`] = [];
        paths[`${j},${i}`] = [];
      } else {
        console.log(
          `Shortest path for nodes ${i} -> ${j} found with cost ${shortestCost} after ${attempts} attempts`
        );
        distances[`${i},${j}`] = shortestCost;
        distances[`${j},${i}`] = shortestCost;
        paths[`${i},${j}`] = shortestPath;
        paths[`${j},${i}`] = [...shortestPath].reverse();
      }
    }
  }
}

main();
