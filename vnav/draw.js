const sharp = require("sharp");

const config = {
  input: "map.png",
  output: "output.png",
  radius: 8,
  lineColor: "red",
  lineWidth: 2,
};

const connections = [
  [
    [295.64, 322.61],
    [293.91, 355.45],
  ],
  [
    [307.39, 311.06],
    [339.73, 321.51],
  ],
  [
    [309.04, 314.5],
    [321.17, 335.64],
  ],
  [
    [331.43, 111.11],
    [342.42, 91.92],
  ],
  [
    [-337.27, -419.95],
    [-333.29, -451.97],
  ],
  //   New
  [
    [-175.51, -607.24],
    [-183.04, -607.21],
  ],
  [
    [-416, -562.77],
    [-439.071, -556.1],
  ],
  [
    [-500.08, -552.53],
    [-509.95, -552.91],
  ],
  [
    [5.23, -390.92],
    [16.14, -437.46],
  ],
];

function mapToImage(x, z, dimension) {
  const max = dimension / 2;
  const min = -max;

  const normX = (x - min) / (max - min);
  const normZ = (z - min) / (max - min);

  const px = normX * dimension;
  const py = normZ * dimension;

  return [px, py];
}

async function drawConnectionsOnImage() {
  const image = sharp(config.input);
  const metadata = await image.metadata();
  const { width, height } = metadata;

  const lines = connections.map(([[x1, z1], [x2, z2]], index) => {
    const [p1x, p1y] = mapToImage(x1, z1, width);
    const [p2x, p2y] = mapToImage(x2, z2, width);

    if (index > 4) {
      config.lineColor = "blue"; // Change color for new connections
    }

    return `<line x1="${p1x}" y1="${p1y}" x2="${p2x}" y2="${p2y}" stroke="${config.lineColor}" stroke-width="${config.lineWidth}" />`;
  });

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${lines.join("\n")}
    </svg>
  `;

  await image.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).toFile(config.output);

  console.log(`Saved to ${config.output}`);
}

drawConnectionsOnImage().catch(console.error);
