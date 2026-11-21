// Who the API answers. By default, only this machine, by its own name. A page on any website can
// send requests to localhost, and one that renames itself to a local address (DNS rebinding) could
// read the canvas; notes reach Claude sessions as the person's own words, so a forged one would be
// an instruction from a stranger. So the API answers only requests addressed to a local host name,
// and changes only from pages it served itself (or from no page at all: the MCP server, scripts,
// curl).
//
// Optionally, one more name: the machine's tailnet name, for a canvas put on the tailnet with
// `tailscale serve` (the server itself stays on 127.0.0.1). Tailscale serve adds the signed-in
// person's login to each request it forwards as Tailscale-User-Login, and drops any a client sent;
// a change through that name must carry one of the logins allowed to write.
//
//   ROUNDS_TAILNET_HOST   the name, e.g. laptop.example.ts.net (any port)
//   ROUNDS_TAILNET_USER   logins that may change things, comma separated; without one, the
//                         canvas is read-only through the tailnet name
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

const list = (s) => String(s || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);

export function guard(env = process.env) {
  const tailnet = String(env.ROUNDS_TAILNET_HOST || "").trim().toLowerCase().replace(/\.$/, "");
  const users = list(env.ROUNDS_TAILNET_USER);
  const onTailnet = (host) => {
    if (!tailnet) return false;
    const h = String(host || "").toLowerCase();
    return h === tailnet || new RegExp(`^${tailnet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\d+$`).test(h);
  };
  const originHost = (o) => { try { return new URL(o).host; } catch { return null; } };

  return (req) => {
    const host = String(req.headers.host || "");
    const write = !(req.method === "GET" || req.method === "HEAD");
    const origin = req.headers.origin;
    if (LOCAL.test(host)) {
      if (!write || !origin) return true;
      const o = originHost(origin);
      return !!o && LOCAL.test(o);
    }
    if (onTailnet(host)) {
      if (!write) return true;
      const login = String(req.headers["tailscale-user-login"] || "").trim().toLowerCase();
      if (!login || !users.includes(login)) return false;
      if (!origin) return true;
      return originHost(origin)?.toLowerCase() === host.toLowerCase();
    }
    return false;
  };
}
