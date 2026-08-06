/// <reference path="../pb_data/types.d.ts" />

/**
 * Unique index on (world_id, x, y, z) for `blocks` — see design.md section 6:
 * "Last write wins via upsert." The client does a find-or-create on this
 * tuple; the unique index is what makes that safe under concurrent writes
 * from multiple students.
 */
const INDEX_NAME = 'idx_blocks_world_xyz'
const INDEX_SQL = `CREATE UNIQUE INDEX ${INDEX_NAME} ON blocks (world_id, x, y, z)`

migrate((app) => {
  const blocks = app.findCollectionByNameOrId('blocks')
  blocks.indexes = [...blocks.indexes, INDEX_SQL]
  app.save(blocks)
}, (app) => {
  const blocks = app.findCollectionByNameOrId('blocks')
  blocks.indexes = blocks.indexes.filter((index) => !index.includes(INDEX_NAME))
  app.save(blocks)
})
