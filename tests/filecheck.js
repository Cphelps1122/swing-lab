// Run: node tests/filecheck.js  — checks the page script and store.js parse, and no Claude-only hooks remain.
const fs = require("fs"), vm = require("vm"), path = require("path");
const root = path.join(__dirname, ".."); let bad = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) bad++; };
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
scripts.forEach((s, i) => { try { new vm.Script(s); ok(true, `inline script ${i + 1} parses`); } catch (e) { ok(false, `inline script ${i + 1}: ${e.message}`); } });
try { new vm.Script(fs.readFileSync(path.join(root, "js/store.js"), "utf8")); ok(true, "js/store.js parses"); } catch (e) { ok(false, "js/store.js: " + e.message); }
ok(!html.includes("window.claude"), "no Claude-only window.claude calls");
ok(!html.includes("/_blob/"), "no Claude-only /_blob/ video links");
ok(html.includes('src="js/store.js"'), "store.js is loaded");
const j = JSON.parse(fs.readFileSync(path.join(root, "js/old-library.json"), "utf8"));
ok(j.swings && j.pitches && j.sessions, "old-library.json has swings, pitches, sessions");
const owner = /OWNER_EMAIL = "([^"]+)"/.exec(fs.readFileSync(path.join(root, "js/store.js"), "utf8"))[1];
for (const f of ["firestore.rules", "storage.rules"]) ok(fs.readFileSync(path.join(root, f), "utf8").includes(owner), `${f} owner email matches store.js`);
process.exit(bad ? 1 : 0);
