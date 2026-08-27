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

