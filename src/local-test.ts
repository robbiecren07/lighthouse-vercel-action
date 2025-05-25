import fs from 'fs'
import lighthouse from 'lighthouse'
import type { Config, Flags, RunnerResult } from 'lighthouse'
import * as chromeLauncher from 'chrome-launcher'
import mobileConfig from 'lighthouse/core/config/lr-mobile-config.js'

const testUrl = 'https://<vercel-preview-url>'

async function runLocalLighthouse() {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu'],
  })

  const flags: Flags = {
    port: chrome.port,
    output: ['json'],
    logLevel: 'info',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
  }

  const config: Config = {
    ...mobileConfig,
    settings: {
      ...mobileConfig.settings,
      throttlingMethod: 'provided',
    },
  }

  const result = (await lighthouse(testUrl, flags, config)) as RunnerResult
  if (!result) {
    throw new Error('Lighthouse returned no result')
  }

  const { lhr, report } = result

  const [jsonReport] = report as [string]

  fs.writeFileSync('lighthouse-report.json', jsonReport)

  console.log('✅ Scores:')
  for (const [key, value] of Object.entries(lhr.categories)) {
    const score = value.score !== null ? value.score * 100 : 'N/A'
    console.log(`${key}: ${score}`)
  }

  chrome.kill()
}

runLocalLighthouse()
