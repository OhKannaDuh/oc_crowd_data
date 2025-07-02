import sharp from "sharp";

export async function get_pixel_data(path) {
  // Load image and get raw pixel data
  const image = sharp(path);
  const { data, info } = await image
    .raw()
    .toBuffer({ resolveWithObject: true });

  // info contains width, height, channels
  console.log("Image info:", info);

  // Collect pixels in an array (optional)
  const pixels = [];

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const idx = (y * info.width + x) * info.channels;
      const pixel = [];
      for (let c = 0; c < info.channels; c++) {
        pixel.push(data[idx + c]);
      }
      // For example, push pixel data
      pixels.push({ x, y, pixel });
    }
  }

  return { pixels, info };
}
