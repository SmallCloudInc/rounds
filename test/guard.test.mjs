import test from "node:test";
import assert from "node:assert/strict";
import { guard } from "../server/guard.mjs";

const req = (method, headers) => ({ method, headers });
const T = "box.example.ts.net";
const open = guard({ ROUNDS_TAILNET_HOST: T, ROUNDS_TAILNET_USER: "me@example.com, Other@Example.com" });
const plain = guard({});

test("this machine, as before", () => {
  assert.equal(plain(req("GET", { host: "localhost:4797" })), true);
  assert.equal(plain(req("POST", { host: "127.0.0.1:4797" })), true);
  assert.equal(plain(req("POST", { host: "localhost:4797", origin: "http://localhost:4797" })), true);
  assert.equal(plain(req("POST", { host: "localhost:4797", origin: "https://evil.example" })), false);
  assert.equal(plain(req("GET", { host: "evil.example" })), false);
});

test("the tailnet name is refused unless set", () => {
  assert.equal(plain(req("GET", { host: T })), false);
  assert.equal(plain(req("POST", { host: T, "tailscale-user-login": "me@example.com" })), false);
});

test("reads through the tailnet name", () => {
  assert.equal(open(req("GET", { host: T })), true);
  assert.equal(open(req("GET", { host: `${T}:8443` })), true);
  assert.equal(open(req("GET", { host: `x${T}` })), false);
  assert.equal(open(req("GET", { host: `${T}.evil.example` })), false);
});

test("changes through the tailnet name need an allowed login", () => {
  assert.equal(open(req("POST", { host: T, "tailscale-user-login": "me@example.com", origin: `https://${T}` })), true);
  assert.equal(open(req("POST", { host: T, "tailscale-user-login": "other@example.com" })), true);
  assert.equal(open(req("POST", { host: T })), false);
  assert.equal(open(req("POST", { host: T, "tailscale-user-login": "stranger@example.com" })), false);
  assert.equal(open(req("DELETE", { host: T, "tailscale-user-login": "stranger@example.com" })), false);
  assert.equal(open(req("POST", { host: T, "tailscale-user-login": "me@example.com", origin: "https://evil.example" })), false);
  assert.equal(open(req("POST", { host: `${T}:8443`, "tailscale-user-login": "me@example.com", origin: `https://${T}` })), false);
  assert.equal(open(req("POST", { host: `${T}:8443`, "tailscale-user-login": "me@example.com", origin: `https://${T}:8443` })), true);
});

test("read-only through the tailnet name when no login is allowed", () => {
  const ro = guard({ ROUNDS_TAILNET_HOST: T });
  assert.equal(ro(req("GET", { host: T })), true);
  assert.equal(ro(req("POST", { host: T, "tailscale-user-login": "me@example.com" })), false);
});
