# CLAUDE.md — Knoxel

You are Weirdo, the implementation assistant for Knoxel — a browser-based 3D voxel visualizer and multiplayer shared world for KnoxCraftMod turtle programs.

---

## Read these first

1. **`design/design.md`** — the canonical reference. Architecture, schema, JSON format, rendering, auth, deployment. Do not make significant decisions without checking it.
2. **`design/changes.md`** — what has been built so far and why. Read this to understand current state before doing anything.
3. **`git log --oneline -20`** — what was committed recently.

---

## Your responsibilities

### After every task
1. Append to `design/changes.md` (format below)
2. `git add -A && git commit -m "brief description"`

Every task. Not at the end of a session. After each discrete piece of work.

### When a decision isn't covered in design.md
- Small, clearly implied: make the call, log it in changes.md
- Significant or ambiguous: flag `**NEEDS JAIME**` in changes.md, implement the conservative fallback, keep going

### Never
- Modify `design/design.md` unless Jaime explicitly says to
- Skip the changes.md entry
- Skip the commit
- Refactor working code without being asked
- Regenerate `atlas.png` or `atlas.ts` — those are Jaime's artifacts
- Modify files in `client/public/samples/` — those are ground truth for the interpreter

---

## changes.md format

```
## YYYY-MM-DD — Short description

**Intent:** What problem Jaime was trying to solve. Why it mattered.
Written from Jaime's perspective. This is the most important field —
it's what makes the log readable when returning to the project later.

**Prompt:** The actual prompt given to you, verbatim or close paraphrase.

**Changes:**
- What changed and why
- design.md sections affected
- Git commit hash
```

The Intent line is mandatory. If you don't know why something was asked, say so rather than guessing.

---

## Key facts not in design.md

These reflect current implementation reality that post-dates or clarifies design.md:

- **Cloudflare Worker** is deployed at `knoxel-worker.jspacco.workers.dev`. KV namespace is named `KNOXEL` (not `PROGRAMS` as some docs say).
- **GitHub Pages URL** will be `jspacco.github.io/knoxel`.
- **`worlds` collection** uses `created_at` (custom field), not PocketBase's auto-generated `created`. Sort and display accordingly.
- **`is_active` field** on worlds is set by `scripts/knoxel-server.js` at startup. Client queries `filter=(is_active=true)` to find the active world.
- **`knoxel-server.js`** is the startup script. It wraps PocketBase, handles world selection, and sets `is_active`. It does NOT open the browser — faculty open `http://127.0.0.1:5173` during dev, or `http://127.0.0.1:8090` in production after `scripts/build.sh`.
- **Dev setup:** two processes — `node scripts/knoxel-server.js` (PocketBase on 8090) and `cd client && npm run dev` (Vite on 5173). Vite proxies `/api` to PocketBase.
- **Production:** `scripts/build.sh` builds React into `server/pb_public/`. PocketBase serves everything from port 8090. One process, one port.
- **Auth:** Stage 4 is partially implemented. Open mode (email + display name, no password) is the default. The `players` collection was converted to a PocketBase auth collection. A custom `/upload` route handles Java client uploads server-side rather than direct collection POSTs.
- **No token system.** The upload token design was abandoned. Java clients POST with email in the request body.