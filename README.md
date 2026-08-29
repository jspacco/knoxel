# Knoxel

A browser-based 3D voxel visualizer for KnoxCraftMod turtle programs — a
Minecraft-inspired way to see what a Java turtle program actually does,
with no Minecraft license or install required.

Students write ordinary Java (the same KnoxCraftMod API used with the
Minecraft mod), and watch their program build in 3D in the browser. Programs
can run solo, or in a shared multiplayer world where a whole class's turtles
build side by side.

<!-- screenshot/gif here -->

## Two ways to run this

**Solo, no server, no install** — students run their Java program, it opens
straight to a 3D view in the browser at
[jspacco.github.io/knoxel](https://jspacco.github.io/knoxel). No login, no
setup. This is the fastest way to try Knoxel or to use it for a quick
in-class demo.

**Shared classroom world** — a small server (you run it, or a colleague
runs it) that a whole class connects to, so everyone's turtles build in the
same world at once, with submissions saved for grading/research. This needs
the server download below.

## Get Knoxel

- **Running your own shared server:** download the zip for your platform
  from the [latest release](../../releases/latest) —
  `knoxel-mac-arm64.zip`, `knoxel-windows-x64.zip`, or
  `knoxel-linux-x64.zip`. Unzip it and double-click `start.command`
  (Mac) or `start.bat` (Windows) — full instructions are in the
  `README.txt` inside the zip. No installs required; everything's bundled.

- **Student Java project:** `student-knoxel.zip`, also on the
  [latest release](../../releases/latest) — a ready-to-open VS Code
  project with the turtle library already set up and a handful of example
  programs to start from.

## How students write programs

Students write plain Java against the KnoxCraftMod turtle API — move,
turn, place blocks — the same API used with the Minecraft mod, so code
written for one works with the other. See the example programs bundled in
`student-knoxel.zip` for the exact API and a few sample builds (a Mauritius
flag, both single-threaded and in parallel).

## For developers

- [`design/design.md`](design/design.md) — architecture, database schema,
  JSON program format, deployment tiers.
- [`docs/worker-api.md`](docs/worker-api.md) — the Cloudflare Worker's
  exact request/response contract, for anyone building an alternate
  uploader against the static tier.
- [`design/changes.md`](design/changes.md) — running build log.