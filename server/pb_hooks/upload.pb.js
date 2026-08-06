/// <reference path="../pb_data/types.d.ts" />

/**
 * Custom upload endpoint for the Java client (java-client/KnoxelUploader.java).
 * That client already POSTs to `{serverUrl}/upload` with `X-Email`,
 * `X-Password`, `X-Version` headers and a flat JSON body
 * `{version, email, program, description, threads}` (see toJson/upload in
 * KnoxelUploader.java) — that wire format predates this PocketBase rewrite
 * and is left unchanged here rather than pushed onto the Java side, since
 * design.md's "POST to /api/collections/programs/records" (section 7) can't
 * be satisfied directly by the Java client anyway: creating a `programs`
 * record requires a `player_id`, which the Java client has no way to look
 * up on its own. This route does that lookup (find-or-create in open mode,
 * password-checked lookup in accounts mode) and then creates the record.
 *
 * "Active world" is picked as the most recently created `worlds` row —
 * there is no CLI world-selection wrapper yet (design.md section 8
 * describes one but no build stage currently owns writing it), so this is
 * the same conservative stand-in used by the browser login flow
 * (usePocketbase.ts). **NEEDS JAIME**: confirm this is fine until that
 * wrapper exists, since a server with multiple worlds will always route
 * Java uploads to the newest one regardless of which one a given class is
 * actually using.
 */
routerAdd('POST', '/upload', (e) => {
  const email = e.request.header.get('X-Email')
  const password = e.request.header.get('X-Password')

  if (!email) {
    throw new BadRequestError('X-Email header is required.')
  }

  // `e.bindBody()` binds into Go-typed models (DynamicModel etc.) and fights
  // with the arbitrarily-nested `threads` array; parsing the raw body text
  // ourselves gives back plain JS values with no wrapper types to unwrap.
  let body
  try {
    body = JSON.parse(toString(e.request.body))
  } catch (err) {
    throw new BadRequestError('Request body is not valid JSON.')
  }

  const worlds = e.app.findRecordsByFilter('worlds', '', '-created_at', 1, 0)
  if (worlds.length === 0) {
    throw new BadRequestError('No world is configured on this server yet.')
  }
  const world = worlds[0]
  const authMode = world.get('auth_mode')

  let player = null
  try {
    player = e.app.findAuthRecordByEmail('players', email)
  } catch (err) {
    player = null
  }

  if (authMode === 'accounts') {
    if (!player || player.get('world_id') !== world.id || !player.validatePassword(password || '')) {
      throw new UnauthorizedError('Invalid email or password.')
    }
  } else if (!player) {
    player = new Record(e.app.findCollectionByNameOrId('players'))
    player.set('email', email)
    // The Java payload has no display-name field — fall back to the email's
    // local part. Students who also use the browser can set a real one
    // there; players.updateRule allows it in open mode.
    player.set('display_name', email.split('@')[0])
    player.set('world_id', world.id)
    player.set('turtle_facing', 'north')
    // See players.pb.js — email must stay visible for the browser login
    // flow to be able to find this record by email later.
    player.set('emailVisibility', true)
    const generated = $security.randomString(24)
    player.set('password', generated)
    player.set('passwordConfirm', generated)
    e.app.save(player)
  }

  const program = new Record(e.app.findCollectionByNameOrId('programs'))
  program.set('player_id', player.id)
  program.set('world_id', world.id)
  program.set('program_name', body.program || 'program')
  program.set('json_content', {
    description: body.description,
    type: 'parallel',
    threads: body.threads,
  })
  e.app.save(program)

  return e.json(200, { status: 'ok' })
})
