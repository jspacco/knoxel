/**
 * Account provisioning helpers for memorable passwords and email list parsing.
 * See design.md section 7 & 9.
 */

const MEMORABLE_WORDS = [
  'amber', 'atlas', 'autumn', 'badger', 'beaver', 'birch', 'breeze', 'bridge',
  'canyon', 'cedar', 'clover', 'cloud', 'cobalt', 'comet', 'copper', 'coral',
  'creek', 'crystal', 'dawn', 'delta', 'dune', 'eagle', 'echo', 'elm',
  'falcon', 'fern', 'flame', 'forest', 'frost', 'glacier', 'golden', 'harbor',
  'haven', 'hawk', 'island', 'jasper', 'lotus', 'maple', 'meadow', 'moon',
  'moss', 'mountain', 'oasis', 'ocean', 'orbit', 'otter', 'peak', 'pine',
  'prairie', 'quartz', 'raven', 'reef', 'river', 'ruby', 'sage', 'shadow',
  'silver', 'solar', 'spring', 'spruce', 'star', 'stone', 'storm', 'summer',
  'summit', 'sunset', 'swift', 'thunder', 'tiger', 'timber', 'topaz', 'valley',
  'willow', 'winter', 'zenith',
]

/**
 * Generates a random memorable word-pair password with a 2-digit number suffix,
 * e.g. "maple-river-22" per design.md section 9.
 */
export function generateMemorablePassword(): string {
  const i = Math.floor(Math.random() * MEMORABLE_WORDS.length)
  let j = Math.floor(Math.random() * (MEMORABLE_WORDS.length - 1))
  if (j >= i) j++ // ensure distinct words
  const num = Math.floor(10 + Math.random() * 90) // 10 to 99
  return `${MEMORABLE_WORDS[i]}-${MEMORABLE_WORDS[j]}-${num}`
}

/**
 * Parses a plain-text or CSV list of student emails (one per line).
 * Tolerates headers, comments, quotes, names/extra columns, and extracts bare lowercase emails.
 */
export function parseEmailList(input: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
  const lines = input.split(/\r?\n/)
  const emails: string[] = []
  const seen = new Set<string>()

  for (const rawLine of lines) {
    const trimmed = rawLine.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(emailRegex)
    if (match) {
      const email = match[0].toLowerCase()
      if (!seen.has(email)) {
        seen.add(email)
        emails.push(email)
      }
    }
  }

  return emails
}

export interface ProvisionResultItem {
  email: string
  password?: string
  status: 'created' | 'skipped' | 'error'
  reason?: string
}

/**
 * Generates a CSV of email, password pairs for created accounts matching design.md section 9.
 */
export function generateAccountsCsv(createdAccounts: Array<{ email: string; password: string }>): string {
  return createdAccounts.map((a) => `${a.email}, ${a.password}`).join('\n')
}
