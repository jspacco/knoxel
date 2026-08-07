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

First run:
1. Binary starts PocketBase
2. PocketBase detects no superuser exists
3. Wrapper detects this and opens browser to /_/ for superuser creation
   (or just tells faculty: "Open http://localhost:8090/_/ to create your admin account")
4. Faculty creates superuser (email + password, can be anything)
5. Wrapper continues with world selection prompt
6. Done — superuser never needs to be created again

Subsequent runs:
1. Binary starts PocketBase  
2. Superuser already exists, skip
3. World selection prompt
4. Done

- [ ] docs/faculty-setup.md needs a "first run" section covering:
      1. Create superuser at /_/ (one time only)
      2. World creation via CLI prompt
      3. (Accounts mode only) Upload student list via faculty panel
      4. Share server URL with students