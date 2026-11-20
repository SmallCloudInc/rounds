#!/usr/bin/env node
// A git pre-push hook, for pushes made outside Claude: it records what is about to go to the
// default branch (the commits and the files they touched) so the canvas shows the change as a
// note. It never stops a push. Install per repo with `rounds init` (or by hand: see README).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { PUSHES } from "../server/config.mjs";

try {
  const git = (...a) => { try { return execFileSync("git", a, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return ""; } };
  const main = git("symbolic-ref", "--short", "refs/remotes/origin/HEAD").split("/").pop() || (git("rev-parse", "--verify", "-q", "main") ? "main" : "master");
  const repo = git("rev-parse", "--show-toplevel");
  const zero = /^0+$/;
  // stdin: "<local ref> <local sha> <remote ref> <remote sha>" per ref being pushed
  for (const line of fs.readFileSync(0, "utf8").split("\n").filter(Boolean)) {
    const [, local, remoteRef, remote] = line.split(" ");
    if (remoteRef !== `refs/heads/${main}` || zero.test(local)) continue;
    // a branch the remote doesn't have yet: every commit no remote has seen, however few
    const which = zero.test(remote) ? [local, "--not", "--remotes"] : [`${remote}..${local}`];
    const commits = git("log", "--format=%h%x09%s", ...which).split("\n").filter(Boolean).map((l) => { const [sha, ...s] = l.split("\t"); return { sha, subject: s.join("\t") }; });
    if (!commits.length) continue;
    const oldest = git("rev-list", "--reverse", ...which).split("\n")[0];
    const from = zero.test(remote) ? git("rev-parse", "--verify", "-q", `${oldest}^`) : remote;
    const range = from ? `${from}..${local}` : local; // from the very first commit: the sha alone
    const files = [...new Set(git("log", "--name-only", "--format=", ...which).split("\n").filter(Boolean))].slice(0, 200);
    const id = crypto.createHash("sha1").update(`${repo}${range}`).digest("hex").slice(0, 16);
    fs.mkdirSync(PUSHES, { recursive: true });
    fs.writeFileSync(path.join(PUSHES, `${id}.json`), JSON.stringify({
      id, repo, branch: main, range, commits, files, at: Date.now(),
      summary: commits.length === 1 ? commits[0].subject : `${commits.length} commits to ${main}`,
    }, null, 1));
  }
} catch {}
process.exit(0);
