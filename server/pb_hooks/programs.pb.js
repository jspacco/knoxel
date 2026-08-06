/// <reference path="../pb_data/types.d.ts" />

/**
 * Auto-compute instruction_count and thread_count on program upload.
 * `json_content` is the payload shape from design.md section 10 — either
 * `{ instructions: [...] }` (single-turtle) or
 * `{ type: "parallel", threads: [[...], [...]] }` (threaded). Mirrors the
 * discriminator in client/src/lib/interpreter.ts's parsePayload().
 *
 * The counting logic is inlined in the callback rather than pulled out to a
 * top-level helper — PocketBase's JSVM does not reliably keep a plain
 * function declared elsewhere in this file in scope when the hook actually
 * runs (observed as "ReferenceError: <helper> is not defined" at request
 * time, despite the file evaluating fine on server start).
 *
 * `e.record.get('json_content')` returns the raw UTF-8 bytes as a numeric
 * array for JSON fields, not a parsed object or string — `getString()` is
 * the one that hands back the actual JSON text, confirmed by inspecting a
 * live hook invocation. `unmarshalJSONField()` exists but does not populate
 * a plain JS object passed to it from this JSVM, so it's not usable here.
 *
 * Uses the model-level `onRecordCreate` rather than `onRecordCreateRequest`
 * so this runs for every program record however it's created — both the
 * standard REST create endpoint (browser login flow) and the
 * `routerAdd`-based `/upload` route in upload.pb.js (Java client), which
 * saves records directly via `$app.save()` and never touches the request
 * hook chain. Confirmed empirically: with `onRecordCreateRequest`, programs
 * created through `/upload` silently got instruction_count/thread_count 0.
 */
onRecordCreate((e) => {
  let payload = null
  try {
    payload = JSON.parse(e.record.getString('json_content'))
  } catch (err) {
    payload = null
  }

  let instructionCount = 0
  let threadCount = 0
  if (payload && typeof payload === 'object') {
    const threads = payload.type === 'parallel' ? payload.threads : [payload.instructions]
    if (Array.isArray(threads)) {
      const validThreads = threads.filter((thread) => Array.isArray(thread))
      threadCount = validThreads.length
      for (const thread of validThreads) instructionCount += thread.length
    }
  }

  e.record.set('instruction_count', instructionCount)
  e.record.set('thread_count', threadCount)

  e.next()
}, 'programs')
