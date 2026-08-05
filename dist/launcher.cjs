"use strict";

// scripts/launcher-entry.ts
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var import_node_os = require("node:os");
var import_node_child_process = require("node:child_process");
var VERSION = "1.0.10";
var SNAPSHOT_ROOT = (0, import_node_path.join)(__dirname, "..");
var FILES = [
  ["dist/chase.mjs", "dist/chase.mjs"],
  ["dist/pdf.worker.mjs", "dist/pdf.worker.mjs"],
  ["dist/runtime-node.exe", "node.exe"],
  ["templates/AGENTS.md", "templates/AGENTS.md"]
];
var DIRS = [
  ["prompts", "prompts"],
  ["node_modules/pdfjs-dist/standard_fonts", "node_modules/pdfjs-dist/standard_fonts"],
  // pdfjs's optional native canvas (present in dev): silences the four
  // startup warnings and restores the DOMMatrix/ImageData/Path2D polyfills.
  ["node_modules/@napi-rs/canvas", "node_modules/@napi-rs/canvas"],
  ["node_modules/@napi-rs/canvas-win32-x64-msvc", "node_modules/@napi-rs/canvas-win32-x64-msvc"]
];
function runtimeRoot() {
  const base = process.env.LOCALAPPDATA && (0, import_node_fs.existsSync)(process.env.LOCALAPPDATA) ? process.env.LOCALAPPDATA : (0, import_node_os.tmpdir)();
  return (0, import_node_path.join)(base, "paper-chase", "runtime", VERSION);
}
function copyDirRecursive(srcRel, dstRel, root2) {
  const srcDir = (0, import_node_path.join)(SNAPSHOT_ROOT, srcRel);
  for (const entry of (0, import_node_fs.readdirSync)(srcDir, { withFileTypes: true })) {
    const srcSub = `${srcRel}/${entry.name}`;
    const dstSub = `${dstRel}/${entry.name}`;
    if (entry.isDirectory()) {
      copyDirRecursive(srcSub, dstSub, root2);
    } else {
      const target = (0, import_node_path.join)(root2, dstSub);
      if (!(0, import_node_fs.existsSync)(target)) {
        (0, import_node_fs.mkdirSync)((0, import_node_path.dirname)(target), { recursive: true });
        (0, import_node_fs.copyFileSync)((0, import_node_path.join)(SNAPSHOT_ROOT, srcSub), target);
      }
    }
  }
}
var root = runtimeRoot();
var marker = (0, import_node_path.join)(root, ".extracted-ok");
if (!(0, import_node_fs.existsSync)(marker)) {
  process.stderr.write(`Paper Chase: extracting runtime to ${root} (first run only)...
`);
  (0, import_node_fs.mkdirSync)(root, { recursive: true });
  try {
    for (const [srcRel, dstRel] of FILES) {
      const target = (0, import_node_path.join)(root, dstRel);
      if (!(0, import_node_fs.existsSync)(target)) {
        (0, import_node_fs.mkdirSync)((0, import_node_path.dirname)(target), { recursive: true });
        (0, import_node_fs.copyFileSync)((0, import_node_path.join)(SNAPSHOT_ROOT, srcRel), target);
      }
    }
    for (const [srcRel, dstRel] of DIRS) {
      copyDirRecursive(srcRel, dstRel, root);
    }
    (0, import_node_fs.writeFileSync)(
      (0, import_node_path.join)(root, "package.json"),
      JSON.stringify({ name: "paper-chase-runtime", type: "module", private: true }, null, 2) + "\n"
    );
    (0, import_node_fs.writeFileSync)(marker, (/* @__PURE__ */ new Date()).toISOString() + "\n");
  } catch (err) {
    console.error(`Paper Chase: runtime extraction failed: ${err.message}`);
    process.exit(1);
  }
}
var result = (0, import_node_child_process.spawnSync)((0, import_node_path.join)(root, "node.exe"), [(0, import_node_path.join)(root, "dist", "chase.mjs"), ...process.argv.slice(2)], {
  stdio: "inherit"
});
if (result.error) {
  console.error(`Paper Chase: failed to launch runtime: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
