/// <reference path="../pb_data/types.d.ts" />

/**
 * Stage 4 — auth. See design.md section 7.
 *
 * `players` becomes a PocketBase **auth** collection so accounts-mode login
 * can use PocketBase's built-in `authWithPassword` / bcrypt password storage
 * directly, rather than us hand-rolling credential checks. PocketBase does
 * not support converting an existing base collection's `type` in place
 * ("Collection type cannot be changed" — confirmed empirically against this
 * PocketBase version), so this drops and recreates `players` with the same
 * `id` (preserving the `programs.player_id` / `blocks.player_id` relations,
 * which reference that id, not the name) and the same non-system fields from
 * 001_initial_schema.js, plus a `password` field.
 *
 * Open mode never asks students for a password (design.md section 7), but
 * PocketBase's auth-collection create validation requires `password` +
 * `passwordConfirm` on every create regardless of the field's own `required`
 * flag (confirmed empirically — a public create with neither present is
 * rejected with a validation error). pb_hooks/players.pb.js papers over this
 * by auto-filling both with a random string on create when the client didn't
 * supply one; open-mode students never see or need that value since they
 * never call authWithPassword.
 *
 * `createRule`/`listRule`/`viewRule`/`updateRule` below branch on the
 * relation-following `world_id.auth_mode` so the same collection serves both
 * auth modes: open mode is fully public (matches design.md's explicit
 * "students could upload under someone else's email, that's acceptable"
 * risk acceptance); accounts mode requires the request to be authenticated
 * as the record in question. Faculty-driven account provisioning (Stage 5.5)
 * uses a superuser token, which bypasses these rules entirely.
 *
 * `programs.createRule` mirrors the same branch: open mode lets anyone
 * attach a program to any player_id (no token exists to check in open
 * mode), accounts mode requires `@request.auth.id = player_id`.
 * `programs.listRule`/`viewRule` are left fully public — design.md section 7
 * says plainly "turtle programs are not sensitive data."
 *
 * `display_name` also drops its `required: true` (001 had it required,
 * since every player used to be created with one in a single step). Stage
 * 5.5's account-provisioning flow (upload a student email list → create
 * accounts) only has email + password at creation time — the student picks
 * a display name on first login, same as the open-mode flow's
 * find-or-create. Confirmed empirically: provisioning a player with only
 * email + password fails validation otherwise, which would make Stage 5.5
 * impossible to implement against this schema.
 */
migrate((app) => {
  const oldPlayers = app.findCollectionByNameOrId('players')
  const playersId = oldPlayers.id

  const programs = app.findCollectionByNameOrId('programs')
  programs.fields.removeByName('player_id')
  app.save(programs)

  const blocks = app.findCollectionByNameOrId('blocks')
  blocks.fields.removeByName('player_id')
  app.save(blocks)

  app.delete(app.findCollectionByNameOrId('players'))

  const worlds = app.findCollectionByNameOrId('worlds')
  const players = new Collection({
    id: playersId,
    type: 'auth',
    name: 'players',
    fields: [
      // Not required here — see the block comment above. UI-level (Login.tsx)
      // still requires it wherever a student can actually enter one.
      { type: 'text', name: 'display_name', required: false, max: 100 },
      { type: 'bool', name: 'is_faculty' },
      { type: 'relation', name: 'world_id', required: true, maxSelect: 1, collectionId: worlds.id, cascadeDelete: true },
      { type: 'number', name: 'turtle_x', onlyInt: true },
      { type: 'number', name: 'turtle_y', onlyInt: true },
      { type: 'number', name: 'turtle_z', onlyInt: true },
      {
        type: 'select',
        name: 'turtle_facing',
        required: true,
        maxSelect: 1,
        values: ['north', 'south', 'east', 'west'],
      },
      { type: 'date', name: 'last_seen' },
      // Not client-required — see the block comment above. Existing purely
      // so PocketBase's auth machinery has somewhere to store the hash.
      { type: 'password', name: 'password', required: false, min: 0 },
    ],
    passwordAuth: { enabled: true, identityFields: ['email'] },
  })
  players.createRule = "world_id.auth_mode = 'open'"
  players.listRule = "world_id.auth_mode = 'open' || @request.auth.id != ''"
  players.viewRule = "world_id.auth_mode = 'open' || @request.auth.id != ''"
  players.updateRule = "@request.auth.id = id || world_id.auth_mode = 'open'"
  players.deleteRule = null
  app.save(players)

  programs.fields.add(
    new Field({ type: 'relation', name: 'player_id', required: true, maxSelect: 1, collectionId: players.id, cascadeDelete: true }),
  )
  programs.createRule = "@request.auth.id = player_id || player_id.world_id.auth_mode = 'open'"
  programs.listRule = ''
  programs.viewRule = ''
  programs.updateRule = null
  programs.deleteRule = null
  app.save(programs)

  blocks.fields.add(
    new Field({ type: 'relation', name: 'player_id', required: true, maxSelect: 1, collectionId: players.id, cascadeDelete: true }),
  )
  app.save(blocks)

  // worlds: public read so the client can discover the active world and its
  // auth_mode before anyone is logged in. Creation stays superuser/CLI-only.
  worlds.listRule = ''
  worlds.viewRule = ''
  app.save(worlds)
}, (app) => {
  const oldPlayers = app.findCollectionByNameOrId('players')
  const playersId = oldPlayers.id

  const programs = app.findCollectionByNameOrId('programs')
  programs.fields.removeByName('player_id')
  programs.createRule = null
  programs.listRule = null
  programs.viewRule = null
  app.save(programs)

  const blocks = app.findCollectionByNameOrId('blocks')
  blocks.fields.removeByName('player_id')
  app.save(blocks)

  app.delete(app.findCollectionByNameOrId('players'))

  const worlds = app.findCollectionByNameOrId('worlds')
  worlds.listRule = null
  worlds.viewRule = null
  app.save(worlds)

  const players = new Collection({
    id: playersId,
    type: 'base',
    name: 'players',
    fields: [
      { type: 'text', name: 'display_name', required: true, max: 100 },
      { type: 'email', name: 'email', required: true },
      { type: 'bool', name: 'is_faculty' },
      { type: 'relation', name: 'world_id', required: true, maxSelect: 1, collectionId: worlds.id, cascadeDelete: true },
      { type: 'number', name: 'turtle_x', onlyInt: true },
      { type: 'number', name: 'turtle_y', onlyInt: true },
      { type: 'number', name: 'turtle_z', onlyInt: true },
      {
        type: 'select',
        name: 'turtle_facing',
        required: true,
        maxSelect: 1,
        values: ['north', 'south', 'east', 'west'],
      },
      { type: 'date', name: 'last_seen' },
    ],
  })
  app.save(players)

  programs.fields.add(
    new Field({ type: 'relation', name: 'player_id', required: true, maxSelect: 1, collectionId: players.id, cascadeDelete: true }),
  )
  app.save(programs)

  blocks.fields.add(
    new Field({ type: 'relation', name: 'player_id', required: true, maxSelect: 1, collectionId: players.id, cascadeDelete: true }),
  )
  app.save(blocks)
})
