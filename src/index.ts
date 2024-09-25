import fetch from "node-fetch";
import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";
import * as urlParser from "url";
import crypto from "crypto";

const seenUrls = new Set();
const failedUrls = new Set();
const maxRetries = 3;

const getUrl = ({ link, baseUrl }) => {
  try {
    const fullUrl = new URL(link, baseUrl);
    return fullUrl.href;
  } catch (err) {
    console.error(`Invalid URL: ${link}`);
    return null;
  }
};

const downloadImage = async (imageUrl, imagePath, retries = 0) => {
  if (failedUrls.has(imageUrl) || retries > maxRetries) {
    console.error(`Skipping download: ${imageUrl}`);
    return;
  }
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`);

    // Ensure the images directory exists
    const dir = path.dirname(imagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const dest = fs.createWriteStream(imagePath);
    res.body.pipe(dest);
    console.log(`Image saved: ${imagePath}`);
  } catch (err) {
    console.error(
      `Error downloading image: ${err.message}. Retrying (${
        retries + 1
      }/${maxRetries})...`
    );
    setTimeout(() => downloadImage(imageUrl, imagePath, retries + 1), 1000); // Retry after 1 second
  }
};

const generateUniqueFilename = (url) => {
  const hash = crypto.createHash("md5").update(url).digest("hex");
  const ext = path.extname(url);
  return `${hash}${ext}`;
};

const crawl = async ({ url, retries = 0 }) => {
  if (failedUrls.has(url) || retries > maxRetries) {
    console.error(`Skipping URL after too many failed attempts: ${url}`);
    return;
  }

  console.log("Crawling", url);
  if (seenUrls.has(url)) return;
  seenUrls.add(url);

  try {
    const res = await fetch(url);
    const html = await res.text();
    const $ = cheerio.load(html);

    const links = $("a")
      .map((i, link) => link.attribs.href)
      .get()
      .filter((link) => !link.includes("#")); // Skip fragment links

    const imageUrls = $("img")
      .map((i, link) => link.attribs.src)
      .get();

    imageUrls.forEach((imageUrl) => {
      const fullImageUrl = getUrl({ link: imageUrl, baseUrl: url });
      if (fullImageUrl) {
        const filename = generateUniqueFilename(fullImageUrl);
        const imagePath = path.join("images", `${filename}`);
        downloadImage(fullImageUrl, imagePath);
      }
    });

    const { host } = urlParser.parse(url);
    console.log("host", host);

    links
      .filter((link) => {
        const fullUrl = getUrl({ link, baseUrl: url });
        return fullUrl && fullUrl.includes(host);
      })
      .forEach((link) => {
        const fullUrl = getUrl({ link, baseUrl: url });
        if (fullUrl) {
          crawl({ url: fullUrl });
        }
      });
  } catch (err) {
    console.error(
      `Failed to fetch ${url}: ${err.message}. Retrying (${
        retries + 1
      }/${maxRetries})...`
    );
    setTimeout(() => crawl({ url, retries: retries + 1 }), 1000); // Retry after 1 second
  }
};

crawl({ url: "https://wpportfolio.net/" });
