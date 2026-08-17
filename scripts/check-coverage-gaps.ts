import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * Lueckenpruefung: jedes Acceptance Criterion aus features/FV-*.md braucht mindestens einen
 * Test, der seine ID im Namen traegt (.claude/rules/testing.md, Rueckverfolgbarkeit).
 *
 * Zuordnung: ein Testfile gehoert zu einem Feature, wenn irgendwo darin die Feature-ID steht
 * (ueblich im describe-Namen: `describe('FV-2 Lehrgangskatalog – …')`).
 */

const FEATURES_DIR = resolve('features')
const TESTS_DIR = resolve('tests')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

const testFiles = walk(TESTS_DIR).filter(file => file.endsWith('.spec.ts'))
const testContents = testFiles.map(file => ({ file, content: readFileSync(file, 'utf8') }))

const specFiles = readdirSync(FEATURES_DIR).filter(file => /^FV-\d+-.*\.md$/.test(file))

let gaps = 0
const report: string[] = []

for (const specFile of specFiles) {
  const featureId = specFile.match(/^(FV-\d+)/)![1]!
  const spec = readFileSync(join(FEATURES_DIR, specFile), 'utf8')

  const criteria = [...spec.matchAll(/\*\*(AC-\d+):\*\*/g)].map(match => match[1]!)
  if (criteria.length === 0) continue

  const covered = new Set<string>()
  for (const { content } of testContents) {
    if (!content.includes(featureId)) continue
    // Testnamen buendeln mehrere Kriterien ("AC-2/AC-6: …", "AC-1, AC-3: …") –
    // deshalb auch Komma und Schraegstrich als Trenner akzeptieren.
    for (const match of content.matchAll(/\b(AC-\d+)\s*(?=[:,/])/g)) covered.add(match[1]!)
  }

  const missing = criteria.filter(criterion => !covered.has(criterion))
  if (missing.length > 0) {
    gaps += missing.length
    report.push(`${featureId}: ohne Test → ${missing.join(', ')}`)
  }
  else {
    report.push(`${featureId}: ${criteria.length} Acceptance Criteria, alle abgedeckt`)
  }
}

for (const line of report) console.log(line)

if (gaps > 0) {
  console.error(`\n${gaps} Acceptance Criteria ohne Test. Siehe .claude/rules/testing.md.`)
  process.exit(1)
}

console.log('\nKeine Abdeckungslücken.')
