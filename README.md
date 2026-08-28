# TODO

* What this is and how it works
* How to install run your own shared server

## Static tier (jspacco.github.io/knoxel)

No server, no login. Students run their Java program, it POSTs to the
Cloudflare Worker, the browser opens to `?id=<id>` and auto-runs. See
`docs/student-guide.md` for the student-facing flow and the Worker's exact
POST/GET contract.

To build and publish:

```bash
./scripts/build-static.sh   # → client/dist/
```

Publish the contents of `client/dist/` to the repo's GitHub Pages source
(project page, so the Vite base path is `/knoxel/` — override with
`VITE_BASE` if that ever changes). Override `VITE_WORKER_URL` if deploying
against a different Worker than `knoxel-worker.jspacco.workers.dev`.

The Worker itself (`worker/`) only needs `npx wrangler deploy` once; it's not
part of this build step. See `design/design.md` section 3.

## Local/shared server tier (PocketBase)

First run:
1. Binary starts PocketBase.
2. Wrapper checks `knoxel-config.env` for existing admin credentials.
3. None found (or they no longer authenticate, e.g. after wiping
   `pb_data`) — wrapper generates a new superuser account via
   `pocketbase superuser upsert`, authenticates as it, and writes the
   email/password into `knoxel-config.env`. No browser step, no manual
   account creation — this is fully non-interactive.
4. Wrapper continues with world selection prompt.
5. Done — same credentials are reused on every future run, no
   re-creation needed.

Subsequent runs:
1. Binary starts PocketBase.
2. Wrapper reads `knoxel-config.env`, authenticates with the existing
   credentials, skips generation.
3. World selection prompt.
4. Done.

- [ ] docs/faculty-setup.md needs a "first run" section covering:
      1. First run auto-generates admin/faculty credentials into
         `knoxel-config.env` — no manual superuser setup needed.
      2. World creation via CLI prompt.
      3. (Accounts mode only) Upload student list via the faculty panel
         (`/faculty`) to generate student accounts and a downloadable
         email/password CSV.
      4. Share the server URL with students.