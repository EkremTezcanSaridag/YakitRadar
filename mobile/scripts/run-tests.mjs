import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptsDir = dirname(fileURLToPath(import.meta.url))

const testFiles = readdirSync(scriptsDir)
  .filter((file) => file.endsWith('.test.mjs'))
  .sort()

if (testFiles.length === 0) {
  console.error('No test files found in scripts/')
  process.exit(1)
}

const failures = []

for (const file of testFiles) {
  const result = spawnSync(process.execPath, [join(scriptsDir, file)], {
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: '--no-warnings' },
  })

  if (result.status !== 0) {
    failures.push(file)
  }
}

console.log(`\n${testFiles.length - failures.length}/${testFiles.length} test files passed`)

if (failures.length > 0) {
  console.error('Failed test files:')
  for (const file of failures) {
    console.error(`- ${file}`)
  }
  process.exit(1)
}
