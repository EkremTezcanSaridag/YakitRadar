import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const mobileRoot = join(scriptsDir, '..')
const repoRoot = join(mobileRoot, '..')
const readJson = (relativePath) => JSON.parse(readFileSync(join(repoRoot, relativePath), 'utf8'))
const readSource = (relativePath) => readFileSync(join(repoRoot, relativePath), 'utf8')

const appJson = readJson('mobile/app.json')
const packageJson = readJson('mobile/package.json')
const easJson = readJson('mobile/eas.json')
const version = appJson.expo.version

// Sürüm dosyaları ve Android sürüm kodu yayın öncesinde eşit olmalı.
assert.equal(packageJson.version, version, 'package.json version must match app.json')
assert.ok(
  Number.isInteger(appJson.expo.android?.versionCode) && appJson.expo.android.versionCode > 0,
  'android.versionCode must be a positive integer',
)

// GitHub Release, production ortamıyla imzalı APK üretmeli (AAB değil).
const releaseProfile = easJson.build?.release
assert.equal(releaseProfile?.android?.buildType, 'apk', 'release profile must build an APK')
assert.equal(releaseProfile?.environment, 'production', 'release profile must use production env')

// Workflow yalnızca v* tag'lerinde çalışmalı ve Release yazma iznine sahip olmalı.
const workflow = readSource('.github/workflows/release.yml')
assert.match(workflow, /^\s*-\s*'v\*'\s*$/m, 'release workflow must trigger on v* tags')
assert.match(workflow, /contents:\s*write/, 'release workflow needs contents: write permission')
assert.match(workflow, /softprops\/action-gh-release@v2/, 'release workflow must publish a GitHub Release')
assert.match(workflow, /body_path:\s*docs\/RELEASE_NOTES\//, 'release notes must come from docs/RELEASE_NOTES')
assert.match(workflow, /SHA256SUMS\.txt/, 'release must include a checksum file')
assert.match(workflow, /--profile\s+release/, 'release workflow must use the release EAS profile')

// Tag ile aynı sürümün not dosyası repoda bulunmalı, aksi halde workflow durur.
const notesPath = `docs/RELEASE_NOTES/v${version}.md`
assert.ok(existsSync(join(repoRoot, notesPath)), `missing release notes: ${notesPath}`)

console.log('release-config tests passed')
