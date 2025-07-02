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

  const threshold = 1024 / 10; // adjust this based on your scale
  const distances = {};
  const paths = {};

  for (let i = 0; i < nodes.length; i++) {
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;

      const dx = nodes[i].x - nodes[j].x;
      const dz = nodes[i].z - nodes[j].z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist <= threshold) {
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

        const gridClone = gridInstance.clone();
        const path = finder.findPath(x1, y1, x2, y2, gridClone);
        const cost = path.length;

        distances[`${i},${j}`] = cost;
        paths[`${i},${j}`] = path;

        console.log(`Linked ${i} -> ${j}: ${cost} steps`);
      }
    }
  }

  console.log(
    "All pairwise paths computed. Searching for optimal order (TSP)..."
  );

  function* permutations(arr, depth = 0) {
    if (arr.length <= 1) {
      console.log(`Yielding permutation at depth ${depth}: [${arr}]`);
      yield arr;
    } else {
      for (let i = 0; i < arr.length; i++) {
        const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
        console.log(`permute [${arr[i]}] + rest [${rest}] at depth ${depth}`);
        for (let perm of permutations(rest, depth + 1)) {
          yield [arr[i], ...perm];
        }
      }
    }
  }

  let bestOrder = null;
  let bestCost = Infinity;
  let count = 0;
  let permChecked = 0;

  const nodeKeys = [...nodes.keys()];
  console.log(
    `Evaluating ${nodeKeys.length}! (${factorial(
      nodeKeys.length
    )}) permutations...`
  );

  function factorial(n) {
    return n <= 1 ? 1 : n * factorial(n - 1);
  }

  for (const perm of permutations(nodeKeys)) {
    permChecked++;
    let total = 0;
    let valid = true;

    for (let i = 0; i < perm.length - 1; i++) {
      const key = `${perm[i]},${perm[i + 1]}`;
      const cost = distances[key];
      if (cost === undefined || cost === Infinity) {
        valid = false;
        break;
      }
      total += cost;
    }

    if (!valid) {
      console.log(`Skipping invalid path: [${perm.join(", ")}]`);
      continue;
    }

    if (total < bestCost) {
      bestCost = total;
      bestOrder = perm;
      console.log(
        `New best path #${++count}: [${bestOrder.join(
          " -> "
        )}] with cost ${bestCost}`
      );
    } else {
      console.log(
        `Checked path #${permChecked}: [${perm.join(" -> ")}], cost: ${total}`
      );
    }
  }

  console.log("Best order found:", bestOrder.join(" -> "));
  console.log("Generating final path...");

  const finalPath = [];
  for (let i = 0; i < bestOrder.length - 1; i++) {
    const a = bestOrder[i];
    const b = bestOrder[i + 1];
    finalPath.push(...paths[`${a},${b}`]);
  }

  const { data, info: imageInfo } = await sharp("collision_mask.png")
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  function drawPixel(data, x, y, width, color) {
    const idx = (y * width + x) * 4;
    data[idx] = color[0];
    data[idx + 1] = color[1];
    data[idx + 2] = color[2];
    data[idx + 3] = color[3];
  }

  for (const [x, y] of finalPath) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (
          nx >= 0 &&
          ny >= 0 &&
          nx < imageInfo.width &&
          ny < imageInfo.height
        ) {
          drawPixel(data, nx, ny, imageInfo.width, [0, 255, 0, 255]);
        }
      }
    }
  }

  await sharp(data, {
    raw: {
      width: imageInfo.width,
      height: imageInfo.height,
      channels: 4,
    },
  })
    .png()
    .toFile("final_path.png");

  console.log("✅ Final path image saved as final_path.png");
}

main();
