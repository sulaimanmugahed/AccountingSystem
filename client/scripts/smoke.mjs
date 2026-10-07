/**
 * Dev-only smoke-test runner. Bundles the TypeScript smoke tests with esbuild and
 * executes them in Node, so the client can be verified without a browser:
 *
 *   npm run smoke          # both suites
 *   npm run smoke:mock     # mock API integration (fast, no DOM)
 *   npm run smoke:render   # renders every route in jsdom and drives a real form
 *
 * Neither suite talks to the .NET API — both run against the bundled mock backend.
 */
import { build } from 'esbuild'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const clientRoot = resolve(here, '..')
const outDir = resolve(clientRoot, 'node_modules/.cache/smoke')

const targets = {
  mock: {
    entry: resolve(here, 'mock-smoke.ts'),
    outfile: resolve(outDir, 'mock-smoke.mjs'),
    options: { platform: 'node', format: 'esm', target: 'node20' },
  },
  render: {
    entry: resolve(here, 'render-smoke.tsx'),
    outfile: resolve(outDir, 'render-smoke.mjs'),
    options: { platform: 'node', format: 'esm', target: 'node20', jsx: 'automatic', jsxDev: true, external: ['jsdom'] },
  },
}

const requested = process.argv.slice(2).filter((arg) => arg in targets)
const selected = requested.length ? requested : Object.keys(targets)

function run(file) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [file], { cwd: clientRoot, stdio: 'inherit' })
    child.on('exit', (code) => (code === 0 ? resolvePromise() : reject(new Error(`${file} exited with code ${code}`))))
  })
}

mkdirSync(outDir, { recursive: true })

let failed = false
for (const name of selected) {
  const { entry, outfile, options } = targets[name]
  console.log(`\n▶ ${name} smoke test`)
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    logLevel: 'warning',
    loader: { '.css': 'empty' },
    alias: { '@': resolve(clientRoot, 'src') },
    define: {
      'import.meta.env.VITE_USE_MOCK': '"true"',
      'import.meta.env.VITE_API_BASE_URL': '"/api"',
    },
    ...options,
  })
  try {
    await run(outfile)
  } catch (error) {
    console.error(String(error.message ?? error))
    failed = true
  }
}

process.exit(failed ? 1 : 0)
