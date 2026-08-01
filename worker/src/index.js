/**
 * Knoxel Cloudflare Worker
 *
 * Ephemeral mailbox between the Java IDE and the browser.
 * Students POST their turtle program JSON from VS Code,
 * get back a short ID, and the browser opens automatically
 * to knoxel.github.io/?id=<ID> to fetch and run it.
 *
 * Programs are stored for 24 hours then deleted automatically.
 *
 * Three operations:
 *   POST /        — store JSON, return { id }
 *   GET /?id=xyz  — retrieve JSON by ID
 *   OPTIONS /     — CORS preflight
 *
 * KV namespace: KNOXEL (bound in wrangler.toml)
 */

// Update this to match your actual GitHub Pages URL once confirmed.
// Either 'https://jspacco.github.io' or 'https://knoxel.github.io'
const ALLOWED_ORIGIN = 'https://jspacco.github.io'

const TTL_SECONDS = 60 * 60 * 24  // 24 hours

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    // POST / — store program JSON, return short ID
    if (request.method === 'POST') {
      const body = await request.text()

      if (!body || body.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Empty body' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Sanity check — make sure it's valid JSON before storing
      try {
        JSON.parse(body)
      } catch {
        return new Response(
          JSON.stringify({ error: 'Invalid JSON' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Generate a short random ID — 8 chars, URL-safe
      const id = crypto.randomUUID().replace(/-/g, '').slice(0, 8)

      await env.KNOXEL.put(id, body, { expirationTtl: TTL_SECONDS })

      return new Response(
        JSON.stringify({ id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // GET /?id=xyz — retrieve program JSON by ID
    if (request.method === 'GET') {
      const id = url.searchParams.get('id')

      if (!id) {
        return new Response(
          JSON.stringify({ error: 'Missing id parameter' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const value = await env.KNOXEL.get(id)

      if (!value) {
        return new Response(
          JSON.stringify({ error: 'Program not found or expired' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        value,
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Anything else
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}