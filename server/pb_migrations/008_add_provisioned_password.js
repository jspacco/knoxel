/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 008: Add provisioned_password field to players collection.
 *
 * In accounts mode, student accounts are provisioned in bulk by faculty by
 * uploading a list of emails. PocketBase stores the generated password as a
 * bcrypt hash, which cannot be retrieved later. To allow faculty to look up
 * student passwords on demand from the faculty dashboard without needing a
 * password rotation/regeneration mechanism, the plaintext password is saved
 * to this provisioned_password field at creation time.
 *
 * This is a deliberate, explicit security tradeoff for a low-stakes classroom tool.
 */
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('players')
    collection.fields.add(new TextField({ name: 'provisioned_password', required: false }))
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('players')
    collection.fields.removeByName('provisioned_password')
    app.save(collection)
  },
)
