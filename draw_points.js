const sharp = require("sharp");
const fs = require("fs");
const { off } = require("process");

const config = {
  input: "southhorn.jpg",
  output: "output.jpg",
  csv: "object_position_data.csv",
  radius: 8,
};

function getData() {
  const lines = fs.readFileSync(config.csv, "utf8").trim().split("\n");

  return lines.slice(1).map((line) => {
    const values = line
      .split(",")
      .map((value) => value.trim().replace(/^"|"$/g, ""));
    return {
      type: values[0],
      model_id: isNaN(values[1]) ? values[1] : parseInt(values[1], 10),
      submissions: parseInt(values[2], 10),
      x: parseFloat(values[3]),
      y: parseFloat(values[4]),
      z: parseFloat(values[5]),
    };
  });
}

function saveDataAsJson() {
  const data = getData();
  fs.writeFileSync(
    "object_position_data.json",
    JSON.stringify(data, null, 2),
    "utf8"
  );
}
saveDataAsJson();

function mapToImage(x, z, dimension) {
  const max = dimension / 2;
  const min = -max;

  const normX = (x - min) / (max - min); // 0 to 1
  const normZ = (z - min) / (max - min); // 0 to 1

  const px = normX * dimension;
  const py = normZ * dimension;

  return [px, py];
}

// === MAIN FUNCTION ===
async function drawPointsOnImage() {
  const image = sharp(config.input);
  const metadata = await image.metadata();
  const { width, height } = metadata;

  const circles = getData()
    .map((datum) => {
      const [x, y] = mapToImage(datum.x, datum.z, width);

      let color = "blue";
      if (datum.type === "Treasure") {
        color = "purple";
        if (datum.model_id === 1596) {
          color = "brown";
        }

        if (datum.model_id === 1597) {
          color = "silver";
        }
      }

      if (datum.type === "Carrot") {
        color = "orange";
      }

      return `<circle cx="${x}" cy="${y}" r="${config.radius}" fill="${color}" stroke="black" stroke-width="2" />`;
    })
    .join("\n");

  // Create SVG overlay
  // const circles = carrots
  //   .map((coord) => {
  //     const [px, py] = mapToImage(
  //       coord.x,
  //       coord.z,
  //       width,
  //       height,
  //       0 - width / 2,
  //       0 + width / 2,
  //       0 - height / 2,
  //       0 + height / 2
  //     );
  //     return `<circle cx="${px}" cy="${py}" r="${dotRadius}" fill="orange" stroke="black" stroke-width="2" />`;
  //   })
  //   .join("\n");

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${circles}
    </svg>
  `;

  // Overlay and export
  await image
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .toFile(config.output);

  console.log(`Done! Saved to ${config.output}`);
}

drawPointsOnImage().catch(console.error);
