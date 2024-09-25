import fetch from "node-fetch";
import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";
import * as urlParser from "url";

const seenUrls = {};

const getUrl = ({ link, baseUrl }) => {
  try {
    const fullUrl = new URL(link, baseUrl);
    return fullUrl.href;
  } catch (err) {
    console.error(`Invalid URL: ${link}`);
    return null;
  }
};

const downloadImage = async (imageUrl, imagePath) => {
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
    console.error(`Error downloading image: ${err.message}`);
  }
};

const crawl = async ({ url }) => {
  console.log("Crawling", url);
  if (seenUrls[url]) return;
  seenUrls[url] = true;

  try {
    const res = await fetch(url);
    const html = await res.text();
    const $ = cheerio.load(html);

    const links = $("a")
      .map((i, link) => link.attribs.href)
      .get();

    const imageUrls = $("img")
      .map((i, link) => link.attribs.src)
      .get();

    imageUrls.forEach((imageUrl, index) => {
      const fullImageUrl = getUrl({ link: imageUrl, baseUrl: url });
      const filename = path.basename(fullImageUrl);
      if (fullImageUrl) {
        const imagePath = path.join("images", `${filename}`);
        downloadImage(fullImageUrl, imagePath);
      }
    });

    // const { host } = urlParser.parse(url);

    links
      // .filter((link) => link.includes(host))
      .forEach((link) => {
        const fullUrl = getUrl({ link, baseUrl: url });
        if (fullUrl) {
          crawl({ url: fullUrl });
        }
      });
  } catch (err) {
    console.error(`Failed to fetch ${url}: ${err.message}`);
  }
};

crawl({ url: "https://wpportfolio.net/" });
