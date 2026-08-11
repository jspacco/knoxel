/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: open up client-facing API rules on blocks/players/programs/worlds
 * so the browser client can write blocks and turtle position directly against
 * PocketBase (see hooks/useWorld.ts) instead of routing every write through a
 * superuser-only server hook.
 *
 * This supersedes 003_stage4_auth.js's auth_mode-branching rules on
 * players.createRule/updateRule and programs.createRule with flat, always-on
 * rules — see the NEEDS JAIME note in design/changes.md for this entry: this
 * removes the accounts-mode restriction those branches existed to enforce
 * (previously only an authenticated player, or any player in an open-mode
 * world, could create/update a players row or attach a program to
 * themselves; now anyone can, in either auth mode). Implemented exactly as
 * specified rather than guessed, but flagging since it's a real change to
 * the accounts-mode security model from Stage 4.
 *
 * Rule string reference (confirmed against this repo's installed PocketBase
 * 0.39.10, and matching the property names 003_stage4_auth.js already uses
 * successfully): collection.listRule/viewRule/createRule/updateRule/
 * deleteRule are plain string properties on the Collection object, set to ''
 * for "anyone" or null for "superusers only", then persisted via
 * app.save(collection). No API mismatch found — this is the same syntax
 * already in use elsewhere in this repo.
 */
migrate((app) => {
  const blocks = app.findCollectionByNameOrId('blocks')
  blocks.listRule = ''
  blocks.viewRule = ''
  blocks.createRule = ''
  blocks.updateRule = ''
  blocks.deleteRule = null
  app.save(blocks)

  const players = app.findCollectionByNameOrId('players')
  players.listRule = ''
  players.viewRule = ''
  players.createRule = ''
  players.updateRule = ''
  players.deleteRule = null
  app.save(players)

  const programs = app.findCollectionByNameOrId('programs')
  programs.listRule = ''
  programs.viewRule = ''
  programs.createRule = ''
  programs.updateRule = null
  programs.deleteRule = null
  app.save(programs)

  const worlds = app.findCollectionByNameOrId('worlds')
  worlds.listRule = ''
  worlds.viewRule = ''
  worlds.createRule = null
  worlds.updateRule = null
  worlds.deleteRule = null
  app.save(worlds)
}, (app) => {
  const blocks = app.findCollectionByNameOrId('blocks')
  blocks.listRule = null
  blocks.viewRule = null
  blocks.createRule = null
  blocks.updateRule = null
  blocks.deleteRule = null
  app.save(blocks)

  const players = app.findCollectionByNameOrId('players')
  players.listRule = null
  players.viewRule = null
  players.createRule = null
  players.updateRule = null
  players.deleteRule = null
  app.save(players)

  const programs = app.findCollectionByNameOrId('programs')
  programs.listRule = null
  programs.viewRule = null
  programs.createRule = null
  programs.updateRule = null
  programs.deleteRule = null
  app.save(programs)

  const worlds = app.findCollectionByNameOrId('worlds')
  worlds.listRule = null
  worlds.viewRule = null
  worlds.createRule = null
  worlds.updateRule = null
  worlds.deleteRule = null
  app.save(worlds)
})
