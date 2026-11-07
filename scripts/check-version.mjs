import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
const changelog = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(pkg.version)) {
  throw new Error(`Invalid release version: ${pkg.version}`);
}
if (lock.version !== pkg.version || lock.packages[""].version !== pkg.version) {
  throw new Error("package-lock.json version differs from package.json");
}
if (!changelog.includes(`## ${pkg.version} - `)) {
  throw new Error(`CHANGELOG.md has no entry for ${pkg.version}`);
}
console.log(`Release version ${pkg.version} is consistent.`);
