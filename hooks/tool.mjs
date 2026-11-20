#!/usr/bin/env node
// Claude Code hook for tools, run before and after them:
//
// - After a Rounds post, the post is tied to the session that made it, at once (the hook is
//   the one place that knows the session's id), so notes on it find their way back without
//   waiting for the canvas to read transcripts again.
// - After a `git push` that moved the remote's default branch, the session is asked to record
//   the change. Read from git itself (the remote branch's own log), so a quiet push counts, and
//   so does one run from another folder (cd there && git push, git -C there push).
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { DATA, POSTS } from "../server/config.mjs";

let input = {};
try { input = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); } catch {}
const event = input.hook_event_name || "PostToolUse";
const tool = String(input.tool_name || "");
const cwd = input.cwd || process.cwd();
const session = input.session_id || "";
const say = (context) => process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: context } }));

// ---- a post: bind it to this session --------------------------------------------------------
if (/(rounds|workbench)_(post|change)$/.test(tool) && event === "PostToolUse") {
  const said = JSON.stringify(input.tool_response || "");
  const id = said.match(/\bpost ([a-f0-9]{16})\b/)?.[1];
  const file = id && path.join(POSTS, `${id}.json`);
  if (file && fs.existsSync(file) && session) {
    const post = JSON.parse(fs.readFileSync(file, "utf8"));
    post.session = session;
    fs.writeFileSync(file, JSON.stringify(post, null, 1));
    fs.writeFileSync(path.join(DATA, "posted"), String(Date.now()));
  }
  process.exit(0);
}

// ---- a push --------------------------------------------------------------------------------
if (event !== "PostToolUse") process.exit(0); // (installs before Nov 19 also ran this before each command)
const command = String(input.tool_input?.command || "");
// a push is a step of the command that runs `git push` (after cd, or with -C), not those words
// appearing in a file it writes
const pushes = command.split(/&&|\|\||[;|\n]/).some((step) => /^\s*(?:\w+=\S*\s+)*git(?:\s+-[Cc]\s+\S+)*\s+push\b/.test(step));
if (tool !== "Bash" || !pushes) process.exit(0);

// The repo: the session's folder, or one the command names (cd there && git push, git -C there push).
const named = [...command.matchAll(/(?:\bcd|\bgit\s+-C)\s+("[^"]+"|'[^']+'|[^\s;&|]+)/g)]
  .map((m) => m[1].replace(/^["']|["']$/g, "").replace(/^~(?=\/|$)/, os.homedir()));
const run = (dir, ...a) => { try { return execFileSync("git", a, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return ""; } };
let repo = "";
for (const d of [...named.map((n) => path.resolve(cwd, n)).reverse(), cwd]) if ((repo = run(d, "rev-parse", "--show-toplevel"))) break;
if (!repo) process.exit(0);
const git = (...a) => run(repo, ...a);
const main = git("symbolic-ref", "--short", "refs/remotes/origin/HEAD").split("/").pop() || (git("rev-parse", "--verify", "-q", "refs/heads/main") ? "main" : "master");

// What the push moved, read from the remote branch's own log: git writes an entry there for
// every update a push makes, so a quiet push counts, and nothing is needed from before it ran.
const log = git("reflog", "show", "--date=unix", "--format=%H %gd %gs", `refs/remotes/origin/${main}`, "-n", "2").split("\n").filter(Boolean)
  .map((l) => { const [sha, ref, ...said] = l.split(" "); return { sha, at: Number(ref.match(/@\{(\d+)\}/)?.[1] || 0) * 1000, said: said.join(" ") }; });
const [now, prev] = log;
if (!now || !/^update by push/.test(now.said) || Date.now() - now.at > 120e3) process.exit(0); // nothing reached the default branch
// each push is asked about once
const SAID = path.join(DATA, "pushes-said.json");
let said = {};
try { said = JSON.parse(fs.readFileSync(SAID, "utf8")); } catch {}
if (said[repo] === now.sha) process.exit(0);
said[repo] = now.sha;
fs.mkdirSync(DATA, { recursive: true });
fs.writeFileSync(SAID, JSON.stringify(said));
const short = (x) => x.slice(0, 7);
const range = prev ? `${short(prev.sha)}..${short(now.sha)}` : short(now.sha);

say([
  `${prev ? `You just pushed ${range} to ${main}` : `You just pushed ${main} for the first time, up to ${range},`} in ${repo}. Record it on the Rounds canvas with rounds_change:`,
  `- range: "${range}"`,
  "- summary: what changed for the person using it, in a sentence or two of plain words",
  "- if the change shows on screen: after, screenshots of the screens it touched as they are now; before, the same screens as they were (from screenshots you already took, or by running the previous commit). Same size, same data.",
  "If nothing visible changed, record it with just the range and the summary.",
].join("\n"));
