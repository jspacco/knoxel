/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 007: Fix accounts-mode security regression in API rules.
 *
 * Migration 005 inadvertently overwrote players.createRule/updateRule and
 * programs.createRule with flat '' (always public). This restores the
 * conditional auth_mode branching so accounts-mode worlds enforce ownership
 * (@request.auth.id), while open-mode worlds remain public.
 */
migrate(
  (app) => {
    const players = app.findCollectionByNameOrId('players')
    players.createRule = "world_id.auth_mode = 'open' || @request.auth.id = id"
    players.updateRule = "world_id.auth_mode = 'open' || @request.auth.id = id"
    app.save(players)

    const programs = app.findCollectionByNameOrId('programs')
    programs.createRule = "world_id.auth_mode = 'open' || @request.auth.id = player_id"
    app.save(programs)
  },
  (app) => {
    // down: restore the flat-public rules from 005
    const players = app.findCollectionByNameOrId('players')
    players.createRule = ''
    players.updateRule = ''
    app.save(players)

    const programs = app.findCollectionByNameOrId('programs')
    programs.createRule = ''
    app.save(programs)
  },
)
