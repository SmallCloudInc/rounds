// The film's copy of the demo, set up so the story can happen on camera: the newest Road post
// is held back so it can land while we watch, and one real note is lifted so it can be pinned
// again, then answered with its real reply through the MCP server.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const LANDS = "3937687689a72c5f"; // Bilbo and Frodo, Gandalf the Grey and the White... (The Road, World 1)
export const NOTE = "1c666c98"; // "Rohan is so hard with the arrows and the color between Shadowfax and the field feels off"
export const FIX = "f6b2405a86265686"; // "Rohan's arrows give warning now, and Shadowfax stays white in its sun." (the fix that note got)

export function holdBack(home, url) {
  const held = path.join(home, "held");
  fs.mkdirSync(held, { recursive: true });
  for (const id of [LANDS, FIX]) {
    const post = path.join(home, "posts", `${id}.json`);
    if (fs.existsSync(post)) fs.renameSync(post, path.join(held, `${id}.json`));
  }
  const file = path.join(home, "comments.json");
  const all = JSON.parse(fs.readFileSync(file, "utf8"));
  const note = all.find((c) => c.id === NOTE);
  if (note) fs.writeFileSync(path.join(held, "note.json"), JSON.stringify(note, null, 1));
  // that screen starts with no notes on it, whatever an earlier take left there
  const page = (note || heldNote(home)).page;
  fs.writeFileSync(file, JSON.stringify(all.filter((c) => c.page !== page), null, 1));
  return fetch(`${url}/api/index?fresh`).then((r) => r.json());
}

export function heldNote(home) { return JSON.parse(fs.readFileSync(path.join(home, "held", "note.json"), "utf8")); }

// What the MCP server's workbench_post does: the post file, then the stamp a running canvas watches.
export function land(home, at, id = LANDS) {
  const p = JSON.parse(fs.readFileSync(path.join(home, "held", `${id}.json`), "utf8"));
  p.at = at;
  fs.writeFileSync(path.join(home, "posts", `${id}.json`), JSON.stringify(p, null, 1));
  fs.writeFileSync(path.join(home, "posted"), String(Date.now()));
}

// The session answers through the real MCP server.
export function reply(home, id, text) {
  return new Promise((resolve, reject) => {
    // the command is bin/rounds.mjs after the rename, bin/workbench.mjs before it
    const bin = ["bin/rounds.mjs", "bin/workbench.mjs"].map((b) => path.join(ROOT, b)).find((b) => fs.existsSync(b));
    const mcp = spawn("node", [bin, "mcp"], { env: { ...process.env, ROUNDS_HOME: home }, stdio: ["pipe", "pipe", "inherit"] });
    let buf = "";
    mcp.stdout.on("data", (d) => {
      buf += d;
      for (const line of buf.split("\n").slice(0, -1)) {
        const m = JSON.parse(line);
        if (m.id === 2) { mcp.kill(); m.error ? reject(m.error) : resolve(m.result.content[0].text); }
      }
      buf = buf.split("\n").pop();
    });
    const send = (m) => mcp.stdin.write(JSON.stringify({ jsonrpc: "2.0", ...m }) + "\n");
    send({ id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "film", version: "1" } } });
    send({ method: "notifications/initialized" });
    send({ id: 2, method: "tools/call", params: { name: "rounds_reply", arguments: { id, reply: text } } });
  });
}
