/// <reference path="../pb_data/types.d.ts" />

/**
 * Initial schema: worlds, players, programs, blocks. See design.md section 6.
 *
 * API rules are intentionally left unset (superusers-only) here — open-mode
 * public create/read rules are Stage 4's job (CLAUDE.md), since they depend
 * on auth_mode and the login flow that doesn't exist yet.
 */
migrate((app) => {
  const worlds = new Collection({
    type: 'base',
    name: 'worlds',
    fields: [
      { type: 'text', name: 'name', required: true, max: 200 },
      { type: 'select', name: 'auth_mode', required: true, maxSelect: 1, values: ['open', 'accounts'] },
      { type: 'autodate', name: 'created_at', onCreate: true },
    ],
  })
  app.save(worlds)

  const players = new Collection({
    type: 'base',
    name: 'players',
    fields: [
      { type: 'text', name: 'display_name', required: true, max: 100 },
      { type: 'email', name: 'email', required: true },
      { type: 'bool', name: 'is_faculty' },
      { type: 'relation', name: 'world_id', required: true, maxSelect: 1, collectionId: worlds.id, cascadeDelete: true },
      // Not `required` — PocketBase's NumberField.required means "non-zero",
      // and (0, y, 0) is a perfectly ordinary spawn/turtle position.
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

  const programs = new Collection({
    type: 'base',
    name: 'programs',
    fields: [
      { type: 'relation', name: 'player_id', required: true, maxSelect: 1, collectionId: players.id, cascadeDelete: true },
      { type: 'relation', name: 'world_id', required: true, maxSelect: 1, collectionId: worlds.id, cascadeDelete: true },
      { type: 'text', name: 'program_name', required: true, max: 200 },
      { type: 'json', name: 'json_content', required: true },
      // Computed server-side by pb_hooks/programs.pb.js on create — not
      // client-supplied, so not required here.
      { type: 'number', name: 'instruction_count', onlyInt: true, min: 0 },
      { type: 'number', name: 'thread_count', onlyInt: true, min: 0 },
      { type: 'autodate', name: 'submitted_at', onCreate: true },
    ],
  })
  app.save(programs)

  const blocks = new Collection({
    type: 'base',
    name: 'blocks',
    fields: [
      { type: 'relation', name: 'world_id', required: true, maxSelect: 1, collectionId: worlds.id, cascadeDelete: true },
      { type: 'relation', name: 'player_id', required: true, maxSelect: 1, collectionId: players.id, cascadeDelete: true },
      // Not `required` — see the same note on players.turtle_x above; block
      // coordinates at the world origin (x=0 or z=0) are ordinary, not blank.
      { type: 'number', name: 'x', onlyInt: true },
      { type: 'number', name: 'y', onlyInt: true },
      { type: 'number', name: 'z', onlyInt: true },
      { type: 'text', name: 'block_id', required: true, max: 100 },
      { type: 'autodate', name: 'placed_at', onCreate: true },
    ],
  })
  app.save(blocks)
}, (app) => {
  // Reverse order: collections with relations pointing at others go first.
  for (const name of ['blocks', 'programs', 'players', 'worlds']) {
    const collection = app.findCollectionByNameOrId(name)
    app.delete(collection)
  }
})
