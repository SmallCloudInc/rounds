<p align="center">
  <img src="docs/rounds-mark.svg" width="72" alt="">
</p>

<h1 align="center">Rounds</h1>

<p align="center">Everything your Claude Code sessions make, on one canvas.</p>

[![The Rounds canvas](docs/rounds-og.png)](docs/rounds-film.mp4)

<p align="center"><a href="docs/rounds-film.mp4">Watch the film</a></p>

I run a lot of Claude Code sessions at once and kept losing track of what each one made. Now it
all lands in one place, and I can leave notes on it.

## Try it

```bash
npx github:krispuckett/rounds --demo
```

The demo is six of my public projects and the real notes I left on them. It runs in its own
folder and doesn't touch your setup.

## What it does

Screens, pages and pushes from every session, sorted by project.

![The Road, one of the projects on the canvas](docs/canvas-project.jpg)

Pin a note on a screen. The session that made it gets the note, makes the fix and replies.

![A note on a screen, with the session's reply](docs/canvas-note.jpg)

Drag to compare a screen with the one it replaced.

![A sky before and after a fix](docs/canvas-compare.jpg)

Step back to any day.

![Earlier days stacked behind the current one](docs/canvas-time.jpg)

## Set it up

You need a Mac, Node 20 or newer, and Claude Code.

```bash
npx github:krispuckett/rounds init
```

This adds an MCP server, a skill and two hooks to Claude Code, and asks before each one. Then
open the canvas:

```bash
npx github:krispuckett/rounds
```

This also updates Rounds, hooks included, whenever there's a new version.

To take it all out:

```bash
npx github:krispuckett/rounds uninstall
```

## Privacy

Everything stays in `~/.rounds` on your Mac, and websites can't reach it. To sort older screens
into topics, Rounds asks Claude Haiku through your own Claude Code, sending each one's caption, session
name and file names.

<details>
<summary>More</summary>

### Tools

Sessions post with `rounds_post` and `rounds_change`, read notes with `rounds_notes` and answer
them with `rounds_reply`. One hook brings each session its notes with your next message. The
other ties posts to their session and notices pushes to main.

In auto mode, Claude Code may ask you before acting on a note. Say yes and it carries on.

### Keys

| Key | Does |
| --- | --- |
| V, H, C | Move, hand, comment |
| T | Time machine |
| ← → | A day back, a day forward |
| / or ⌘K | Search |
| 0 | Fit everything |
| Space | Hold to pan, or to see the before while comparing |
| Esc | Back out |

### Config

`~/.rounds/config.json`, every field optional:

```json
{
  "projects": [{ "key": "shop", "name": "Shop", "match": ["shop", "storefront"] }],
  "private": ["acme-internal"],
  "port": 4797
}
```

`projects` groups work by words in its session, folder or caption. Anything matching `private`
never shows up. `ROUNDS_HOME` and `ROUNDS_PORT` override the folder and the port.

### Develop

```bash
npm install
npm run dev     # the canvas, on :4797
npm run eval    # the whole loop with real Claude sessions
```

</details>

## License

MIT. Made by [Kris Puckett](https://krispuckett.com).
