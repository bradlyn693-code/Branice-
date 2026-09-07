import fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync("client/public/manifest.webmanifest", "utf8"));
const vercel = JSON.parse(fs.readFileSync("vercel.json", "utf8"));

if (!manifest.name.includes("Branice😘") || !manifest.short_name.includes("Branice😘")) {
  throw new Error("Manifest branding missing");
}
if (vercel.buildCommand !== "npm run build" || vercel.installCommand !== "npm install") {
  throw new Error("Vercel npm commands missing");
}
console.log("manifest and vercel config validated");
