require("dotenv").config();
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  return args[index + 1] ?? null;
};

const url = getArg("--url");
const output = getArg("--output");

if (!url || !output) {
  console.error("Missing --url or --output argument");
  process.exit(1);
}

const outputPath = path.resolve(output);

(async () => {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  const viewportWidth = Number(process.env.PDF_VIEWPORT_WIDTH || "1200");
  const viewportHeight = Number(process.env.PDF_VIEWPORT_HEIGHT || "1697");
  const pdfScale = Number(process.env.PDF_SCALE || "0.9");
  await page.setViewport({ width: viewportWidth, height: viewportHeight });
  await page.goto(url, { waitUntil: "networkidle0", timeout: 120000 });
  await page.emulateMediaType("screen");
  await page.pdf({
    path: outputPath,
    format: "A4",
    printBackground: true,
    scale: pdfScale,
    preferCSSPageSize: true,
    margin: { top: "10mm", right: "10mm", bottom: "12mm", left: "10mm" },
  });
  await browser.close();
  process.exit(0);
})().catch((error) => {
  console.error(error?.message || "Failed to render PDF.");
  process.exit(1);
});
