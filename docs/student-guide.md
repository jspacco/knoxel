# Student guide — static tier (no server, no login)

This covers the `jspacco.github.io/knoxel` tier: run a Java turtle program
locally, watch it in the browser, no Minecraft, no account, no faculty
server. See `design/design.md` section 3 (Tier 1) for the full architecture.

## The flow

1. Write your turtle program in VS Code, same `Terp`/`ParallelTerp` API as
   always.
2. Your program's JSON gets POSTed to a Cloudflare Worker, which hands back a
   short id.
3. Your browser opens to `https://jspacco.github.io/knoxel/?id=<id>`.
4. The page fetches the program by that id and runs it immediately — no
   login, no drag-and-drop.

Links expire 24 hours after upload. Re-running your Java program generates a
fresh one.

## If you're offline, or the upload fails

Save your program to a `.json` file and open
`https://jspacco.github.io/knoxel` directly — drag the file onto the page, or
use "Paste JSON instead."

## The Worker contract (for anyone extending `KnoxelUploader`)

The Worker (`worker/src/index.js`, deployed at
`knoxel-worker.jspacco.workers.dev`) is a plain ephemeral key/value store. It
has no auth and does not inspect program content beyond checking it's valid
JSON.

**Upload a program:**

```
POST https://knoxel-worker.jspacco.workers.dev/
Content-Type: application/json

<the same flat JSON KnoxelUploader already builds — version/email/program/description/threads>
```

Response, `200 OK`:

```json
{ "id": "xk7r9m2p" }
```

Response, `400 Bad Request` — empty body or invalid JSON:

```json
{ "error": "Empty body" }
```
```json
{ "error": "Invalid JSON" }
```

**Fetch a program:**

```
GET https://knoxel-worker.jspacco.workers.dev/?id=xk7r9m2p
```

Response, `200 OK`: the exact JSON body that was uploaded.

Response, `404 Not Found` — id unknown or expired (TTL is 24 hours):

```json
{ "error": "Program not found or expired" }
```

**Then open the browser to:**

```
https://jspacco.github.io/knoxel/?id=xk7r9m2p
```

The client fetches from the Worker on load, strips `?id=` from the address
bar once it has the program, and runs it. A `404` there shows: "This link
has expired. Re-run your Java program to generate a new link, or drag your
JSON file here."

A Java-side `openInBrowser()` helper that does the POST-then-open-browser
sequence is not part of `KnoxelUploader` yet — that's on Jaime's list, not
implemented here. This document exists so it (or anything else) has an exact
contract to POST against.
