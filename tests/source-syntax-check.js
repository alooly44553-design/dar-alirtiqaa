import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const jsFiles = [];
function walk(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (entry.isFile() && entry.name.endsWith(".js")) jsFiles.push(fullPath);
  }
}
for (const directory of ["api", "lib", "tests"]) walk(path.join(root, directory));
const failures = [];
for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) failures.push({ file: path.relative(root, file), output: (result.stderr || result.stdout).trim() });
}
const zoomHtmlPath = path.join(root, "zoom-operations.html");
if (fs.existsSync(zoomHtmlPath)) {
  const html = fs.readFileSync(zoomHtmlPath, "utf8");
  const blocks = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/gu)];
  if (blocks.length !== 1) {
    failures.push({ file: "zoom-operations.html", output: "Expected exactly one embedded module, found " + blocks.length });
  } else {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dar-alirtiqaa-syntax-"));
    const tempFile = path.join(tempDir, "zoom-operations.mjs");
    try {
      fs.writeFileSync(tempFile, blocks[0][1]);
      const result = spawnSync(process.execPath, ["--check", tempFile], { encoding: "utf8" });
      if (result.status !== 0) failures.push({ file: "zoom-operations.html#module", output: (result.stderr || result.stdout).trim() });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}
if (failures.length) {
  for (const failure of failures) console.error("SYNTAX ERROR " + failure.file + "\n" + failure.output);
  process.exitCode = 1;
} else {
  console.log("JavaScript syntax checks passed for " + jsFiles.length + " files and the embedded Zoom browser module.");
}
