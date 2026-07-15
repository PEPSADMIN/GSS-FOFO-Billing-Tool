const sharp = require("sharp");
const path = require("path");

const SRC = "C:\\Users\\ADMIN\\Pictures\\Peps Logo\\Peps_Logos.png";
const OUT = path.join(__dirname, "..", "assets");

async function squareOnWhite(size, fitWidthFraction) {
  const targetW = Math.round(size * fitWidthFraction);
  const logo = await sharp(SRC).resize({ width: targetW, fit: "inside" }).toBuffer();
  const meta = await sharp(logo).metadata();
  return sharp({ create: { width: size, height: size, channels: 4, background: "#ffffff" } })
    .composite([{ input: logo, top: Math.round((size - meta.height) / 2), left: Math.round((size - meta.width) / 2) }])
    .png()
    .toBuffer();
}

async function foregroundOnTransparent(size, fitWidthFraction) {
  const targetW = Math.round(size * fitWidthFraction);
  const logo = await sharp(SRC).resize({ width: targetW, fit: "inside" }).toBuffer();
  const meta = await sharp(logo).metadata();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: logo, top: Math.round((size - meta.height) / 2), left: Math.round((size - meta.width) / 2) }])
    .png()
    .toBuffer();
}

async function monochromeOnTransparent(size, fitWidthFraction) {
  const targetW = Math.round(size * fitWidthFraction);
  // Recolor the logo to solid black while preserving its alpha shape.
  const resized = await sharp(SRC).resize({ width: targetW, fit: "inside" }).ensureAlpha().toBuffer();
  const meta = await sharp(resized).metadata();
  const alpha = await sharp(resized).extractChannel("alpha").toBuffer();
  const black = await sharp({ create: { width: meta.width, height: meta.height, channels: 3, background: "#000000" } })
    .joinChannel(alpha)
    .png()
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: black, top: Math.round((size - meta.height) / 2), left: Math.round((size - meta.width) / 2) }])
    .png()
    .toBuffer();
}

async function main() {
  await sharp(await squareOnWhite(1024, 0.8)).toFile(path.join(OUT, "icon.png"));
  await sharp(await squareOnWhite(1024, 0.7)).toFile(path.join(OUT, "splash-icon.png"));
  await sharp(await squareOnWhite(48, 0.85)).toFile(path.join(OUT, "favicon.png"));
  await sharp(await squareOnWhite(512, 1)).toFile(path.join(OUT, "android-icon-background.png"));
  await sharp(await foregroundOnTransparent(512, 0.55)).toFile(path.join(OUT, "android-icon-foreground.png"));
  await sharp(await monochromeOnTransparent(432, 0.55)).toFile(path.join(OUT, "android-icon-monochrome.png"));
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
