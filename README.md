# TODO

* What this is and how it works
* How to run jspacco.github.io/knoxel
* How to install run your own shared server

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