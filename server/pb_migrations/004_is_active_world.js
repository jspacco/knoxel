/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: add is_active boolean field to worlds collection
 *
 * Runs automatically when PocketBase starts.
 * No manual execution needed.
 */
migrate(
  // UP
  (app) => {
    const collection = app.findCollectionByNameOrId("worlds")

    const field = new BoolField({
      name:     "is_active",
      required: false,
    })

    collection.fields.add(field)
    app.save(collection)
  },

  // DOWN
  (app) => {
    const collection = app.findCollectionByNameOrId("worlds")
    const field = collection.fields.getByName("is_active")
    if (field) {
      collection.fields.remove(field.id)
      app.save(collection)
    }
  }
)