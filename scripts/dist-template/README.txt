Knoxel — turtle program visualizer, shared classroom world
============================================================

This folder is a self-contained Knoxel server. It runs on your laptop and
students on the same network connect to it with a browser.

Requirements
------------
Node.js must be installed (https://nodejs.org — the LTS version is fine).
Nothing else: PocketBase (the actual server) is already bundled in here as
a plain binary.

First run
---------
1. Double-click start.command (Mac) or start.bat (Windows).
   A terminal window opens and PocketBase starts.
2. You'll be asked to name a world (e.g. "CS102 Week 4") and choose an
   auth mode:
     - Open — students just type their name + school email, no password.
       Simplest option, good default.
     - Accounts — you upload a student email list first and distribute
       generated passwords. More setup, more accountability.
3. Your browser opens automatically, and the terminal prints the same URL
   plus one for other computers on your network, e.g.:

     Open:   http://127.0.0.1:8090
     LAN:    http://192.168.1.42:8090

   Share the "LAN" URL with students on the same Wi-Fi/network — that's the
   one they should type into their browser.

Subsequent runs
----------------
Double-click start.command / start.bat again. You'll pick a world (or press
Enter to reuse the one already shown) and get the same two URLs.

Advanced: database admin access
--------------------------------
Knoxel manages its own PocketBase superuser account behind the scenes, so
you're never asked to create one. If you want to log into PocketBase's own
admin UI (http://127.0.0.1:8090/_/) to poke at the database directly, run
this once from inside this folder (only needs Node/PocketBase, no server
restart required):

  server/pocketbase superuser upsert you@example.com your-own-password --dir server/pb_data

Then log in at /_/ with that email and password any time.

Everything is saved
--------------------
All student programs, blocks placed, and player identities are stored in
the server/pb_data/ folder inside this one. Back it up if you want to keep
a class's work — do not delete it unless you want to start over.

Stopping the server
--------------------
Press Ctrl+C in the terminal window, or just close it.
