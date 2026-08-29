# Knoxel Worker API

The Cloudflare Worker behind the static tier (`jspacco.github.io/knoxel`) —
deployed at `knoxel-worker.jspacco.workers.dev`. Source: `worker/src/index.js`.
See `design/design.md` section 3 (Tier 1) for the surrounding architecture.

This is a plain ephemeral key/value store. It has no auth and does not
inspect program content beyond checking it's valid JSON. Anyone with an id
can fetch that program — acceptable since program content isn't sensitive.

## Upload a program

    POST https://knoxel-worker.jspacco.workers.dev/
    Content-Type: application/json

    <flat JSON — version/email/program/description/threads, per
    design.md section 10>

Response, `200 OK`:

    { "id": "xk7r9m2p" }

Response, `400 Bad Request` — empty body or invalid JSON:

    { "error": "Empty body" }

    { "error": "Invalid JSON" }

## Fetch a program

    GET https://knoxel-worker.jspacco.workers.dev/?id=xk7r9m2p

Response, `200 OK`: the exact JSON body that was uploaded.

Response, `404 Not Found` — id unknown or expired (TTL is 24 hours):

    { "error": "Program not found or expired" }

## Opening the result in the browser

After a successful upload, open:

    https://jspacco.github.io/knoxel/?id=xk7r9m2p

The client fetches from the Worker on load, strips `?id=` from the address
bar once it has the program, and runs it immediately. A `404` there shows:
"This link has expired. Re-run your Java program to generate a new link, or
drag your JSON file here."

## Notes for implementers

- CORS is scoped to `https://jspacco.github.io` — requests from other
  origins will be rejected by the browser even if the Worker itself
  responds.
- There is no rate limiting and no logging of content.
- A Java-side `openInBrowser()` helper that performs the POST-then-open
  sequence lives in `KnoxelUploader` — see its source for the current
  implementation. This document is the contract it targets; if you're
  building an alternate uploader (a different language, a CLI tool, etc.),
  this is everything you need to match its behavior.