Knoxel — turtle program visualizer, shared classroom world
============================================================

This folder is a self-contained Knoxel server. It runs on your laptop or on a server, and students on the same network connect to it with a browser.

Requirements
------------
None. Everything — the server wrapper, the built React client, and PocketBase (the database server) — is already bundled in here as plain binaries. No installs needed.

First run
---------
1. Double-click start.command (Mac) or start.bat (Windows).
  - A terminal window opens and the PocketBase server starts.

2. You'll be asked to name a world (e.g. "CS125-fall2025") 
  - If you hit Enter, the default choice is whole-new-world (yes it's an Aladin reference). That name is fine if you don't care about the name of your world.
   
3. Then you are prompted to choose an auth mode:
  - Open — students just type their name + school email, no password.
       Simplest option, good default. Students can upload using another student's email address. If you are worried about students doing this, set up Accounts.
  - Accounts — you upload a student email list first and distribute
       the generated passwords. More setup, but more accountability.
4. Your browser opens automatically, and the terminal prints the same URL
   plus one for other computers on your network, e.g.:

     Open:   http://127.0.0.1:8090
     LAN:    http://192.168.1.42:8090

   Share the "LAN" URL with students on the same Wi-Fi/network — that's the
   one they should type into their browser.

Stopping the server
--------------------
Press Ctrl+C in the terminal window, or just close it.


Subsequent runs
----------------
Double-click start.command / start.bat again. You'll pick a world (or press
Enter to reuse the one already shown) and get the same two URLs.


Setting up Accounts mode
-------------------------
If you chose Accounts mode when the world was created, students need a
generated password before they can log in — here's how to set that up.

1. Open the faculty dashboard at http://127.0.0.1:8090/faculty (or the LAN
   address, e.g. http://192.168.1.42:8090/faculty).

2. Log in with the email and password from knoxel-config.env (see
   "Advanced: database admin access" below).

3. In the account provisioning section, paste or upload a plain list of
   student emails, one per line:

     alice@knox.edu
     bob@knox.edu
     carol@knox.edu

4. Click to generate accounts. Knoxel creates a login for each student and
   shows you the results — which accounts were created, and which were
   skipped because that student already has one (e.g. if you upload the
   same list twice, or a student already logged in before you switched the
   world to Accounts mode).

5. Download the CSV of generated email/password pairs and send it to your
   students however you normally would (Moodle, email, a handout) — Knoxel
   does not email students directly.

6. Students log in at the student URL using the email and password from
   that CSV, instead of the "type your name and email" flow in Open mode.

If a student loses their password, you don't need to regenerate anything —
just open the faculty dashboard's submissions view, find that student, and
their password is shown there. (This is a low-security, classroom-scale
system by design — passwords are stored so you can look them up again,
not hidden or encrypted the way a bank password would be.)

Switching an existing world from Open to Accounts mode later is possible
from the faculty dashboard too, but any students who already joined under
Open mode won't be able to upload again until you generate a password for
them — Knoxel will warn you about this before the switch happens.

Advanced: database admin access
--------------------------------
Knoxel creates a PocketBase superuser account for you on the first run and stores the email and password credentials in the file `knoxel-config.env` in the variables `PB_ADMIN_EMAIL` `PB_ADMIN_PASSWORD`. On subsequent runs it uses the email and password credentials form this file.

If you want to log into PocketBase's own admin UI (http://127.0.0.1:8090/_/) to poke at the database directly, go to:

http://127.0.0.1:8090/_/ (if logged into the server machine)

http://192.168.1.42:8090/_/ (or whatever address your server is using; this is displayed when you run the server)

Log in with the username and password in knoxel-config.env

Everything is saved
--------------------
All student programs, blocks placed, and player identities are stored in
the server/pb_data/ folder inside this one. Back it up if you want to keep
a class's work — do not delete it unless you want to start over.

