/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: add camera_x/camera_y/camera_z/camera_yaw to players.
 *
 * The player avatar other clients see represents the camera (where the
 * student is looking from), not the turtle — see design.md section 12/13's
 * "camera and turtle are separate objects." Not `required` — same reasoning
 * as turtle_x/y/z in 001_initial_schema.js: PocketBase's NumberField.required
 * means "non-zero," and a camera sitting at x=0 or z=0 is ordinary. A record
 * with no value here already reads as 0 (NumberField's zero value), which is
 * the "nullable, default 0" behaviour asked for.
 */
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('players')
    collection.fields.add(new NumberField({ name: 'camera_x', required: false }))
    collection.fields.add(new NumberField({ name: 'camera_y', required: false }))
    collection.fields.add(new NumberField({ name: 'camera_z', required: false }))
    collection.fields.add(new NumberField({ name: 'camera_yaw', required: false }))
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('players')
    for (const name of ['camera_x', 'camera_y', 'camera_z', 'camera_yaw']) {
      collection.fields.removeByName(name)
    }
    app.save(collection)
  },
)
