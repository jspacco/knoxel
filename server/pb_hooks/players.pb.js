/// <reference path="../pb_data/types.d.ts" />

/**
 * Open-mode signup never asks for a password (design.md section 7), but
 * `players` is a PocketBase auth collection (see pb_migrations/003) and its
 * create validation demands `password` + `passwordConfirm` regardless of the
 * field's own `required` flag. Auto-fill both with a random string when the
 * client didn't supply one. The random value is never returned to the
 * client and open-mode students never call authWithPassword, so it is
 * effectively write-only — accounts-mode records get a real password set by
 * faculty tooling (Stage 5.5) via a superuser token, which overwrites this.
 *
 * Also forces `emailVisibility: true`. PocketBase auth collections hide
 * `email` from API responses AND from filters/search for unauthenticated
 * requests by default when `emailVisibility` is false — confirmed
 * empirically: `players.getFirstListItem('email = ... && world_id = ...')`
 * from an anonymous request returned 404 for a row that plainly had that
 * email, even though an unfiltered list returned it fine. The open-mode
 * browser login flow (usePocketbase.ts) needs to look players up by email
 * with no auth token, so visibility must stay on. This matches design.md
 * section 7's stance that email is "not sensitive data" in open mode.
 */
onRecordCreateRequest((e) => {
  if (!e.record.get('password')) {
    const generated = $security.randomString(24)
    e.record.set('password', generated)
    e.record.set('passwordConfirm', generated)
  }
  if (!e.record.get('turtle_facing')) {
    e.record.set('turtle_facing', 'north')
  }
  e.record.set('emailVisibility', true)
  e.next()
}, 'players')
