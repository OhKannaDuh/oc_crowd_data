const sharp = require("sharp");

const { createCanvas } = require("canvas");
const fs = require("fs");

/**
 * Converts an image to a 2D collision map.
 * Red pixels are treated as blocked (1), others as walkable (0).
 *
 * @param {string} imagePath - Path to the image file.
 * @returns {Promise<number[][]>} - 2D array (rows x cols) collision map.
 */
async function generateCollisionMap(imagePath) {
  const image = sharp(imagePath);
  const { width, height } = await image.metadata();

  // Get raw RGBA pixel data
  const { data } = await image.raw().toBuffer({ resolveWithObject: true });

  const collisionMap = [];

  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      // const a = data[idx + 3]; // Can include alpha if needed

      // Simple red-detection logic (tweak as needed)
      const isRed = r > 150 && g < 100 && b < 100;

      row.push(isRed ? 1 : 0);
    }
    collisionMap.push(row);
  }

  return collisionMap;
}

const PriorityQueue = require("js-priority-queue");

/**
 * A* pathfinding algorithm on a 2D grid.
 * @param {number[][]} grid - 2D array where 1 = blocked, 0 = walkable.
 * @param {[number, number]} start - [x, y] start point.
 * @param {[number, number]} end - [x, y] end point.
 * @returns {Array<[number, number]>} - List of coordinates for the shortest path or [] if no path.
 */
function astar(grid, start, end) {
  const [cols, rows] = [grid[0].length, grid.length];
  const [endX, endY] = end;
  const openSet = new PriorityQueue({ comparator: (a, b) => a.f - b.f });
  const cameFrom = new Map();

  const hash = (x, y) => `${x},${y}`;

  const gScore = Array.from({ length: rows }, () => Array(cols).fill(Infinity));
  gScore[start[1]][start[0]] = 0;

  openSet.queue({ x: start[0], y: start[1], f: heuristic(start, end) });

  function heuristic([x1, y1], [x2, y2]) {
    // Manhattan distance (for 4-directional)
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }

  const directions = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0], // 4-directional
    // [1, 1], [-1, -1], [1, -1], [-1, 1] // Uncomment for diagonal movement
  ];

  while (openSet.length > 0) {
    const { x, y } = openSet.dequeue();

    if (x === endX && y === endY) {
      // Reconstruct path
      const path = [];
      let curr = hash(x, y);
      while (cameFrom.has(curr)) {
        const [px, py] = curr.split(",").map(Number);
        path.unshift([px, py]);
        curr = cameFrom.get(curr);
      }
      path.unshift(start);
      return path;
    }

    for (const [dx, dy] of directions) {
      const [nx, ny] = [x + dx, y + dy];
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      if (grid[ny][nx] === 1) continue; // blocked

      const tentativeG = gScore[y][x] + 1;

      if (tentativeG < gScore[ny][nx]) {
        cameFrom.set(hash(nx, ny), hash(x, y));
        gScore[ny][nx] = tentativeG;
        const fScore = tentativeG + heuristic([nx, ny], end);
        openSet.queue({ x: nx, y: ny, f: fScore });
      }
    }
  }

  return []; // No path found
}

/**
 * Draws a path onto an image and saves it.
 * @param {string} inputPath - Path to the original image.
 * @param {string} outputPath - Path to save the new image.
 * @param {Array<[number, number]>} path - List of [x, y] coordinates.
 */
async function drawPathOnImage(inputPath, outputPath, path) {
  const image = sharp(inputPath);
  const { width, height } = await image.metadata();

  // Create a transparent canvas overlay
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Draw green path
  ctx.strokeStyle = "lime"; // or '#00FF00'
  ctx.lineWidth = 2;
  ctx.beginPath();

  for (let i = 0; i < path.length; i++) {
    const [x, y] = path[i];
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  // Convert canvas to buffer
  const overlayBuffer = canvas.toBuffer("image/png");

  // Composite overlay on original image
  await image
    .composite([{ input: overlayBuffer, blend: "over" }])
    .toFile(outputPath);

  console.log(`Saved with path: ${outputPath}`);
}

generateCollisionMap("./southhorn.png")
  .then((collisionMap) => {
    // 186, 205 -> 800, 800
    console.log("Collision map generated");
    const path = astar(collisionMap, [186, 205], [800, 800]);

    console.log(path);
    drawPathOnImage("southhorn.png", "southhorn-path.png", path);
  })
  .catch((err) => console.error("Error processing image:", err));
