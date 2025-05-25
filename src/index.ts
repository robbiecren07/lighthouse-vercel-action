import * as core from '@actions/core'
import * as github from '@actions/github'
import type { Config, Flags, RunnerResult } from 'lighthouse'
import * as chromeLauncher from 'chrome-launcher'
import mobileConfig from 'lighthouse/core/config/lr-mobile-config.js'

async function run() {
  let chrome: chromeLauncher.LaunchedChrome | undefined

  try {
    const lighthouse = (await import('lighthouse')).default

    const vercelUrl = core.getInput('vercel_url')
    const token = core.getInput('github_token')

    if (!vercelUrl || !vercelUrl.startsWith('http')) {
      throw new Error('Invalid or missing Vercel URL.')
    }

    chrome = await chromeLauncher.launch({
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

    const result = (await lighthouse(vercelUrl, flags, config)) as RunnerResult

    if (!result || !result.lhr) {
      throw new Error('Lighthouse failed to return a result.')
    }

    const { lhr } = result

    const getScore = (category?: { score: number | null }) =>
      category?.score != null ? Math.round(category.score * 100) : -1

    const scores = {
      performance: getScore(lhr.categories.performance),
      accessibility: getScore(lhr.categories.accessibility),
      bestPractices: getScore(lhr.categories['best-practices']),
      seo: getScore(lhr.categories.seo),
    }

    const formatScore = (score: number) => (score >= 0 ? `${score}` : '⚠️ N/A')

    const commentBody = `
## ⚡ Lighthouse Mobile Audit

| Category           |  Score  |
|--------------------|---------|
| ⚡ Performance      |  ${formatScore(scores.performance)}  |
| ♿ Accessibility    |  ${formatScore(scores.accessibility)}  |
| 🔐 Best Practices  |  ${formatScore(scores.bestPractices)}  |
| 🔍 SEO             |  ${formatScore(scores.seo)}  |

> Audited [Preview URL](${vercelUrl})

<!-- lighthouse-comment -->
`

    const octokit = github.getOctokit(token)
    const { context } = github

    const { owner, repo } = context.repo
    const prNumber = context.payload.pull_request?.number

    if (!prNumber) {
      throw new Error('Pull request number not found.')
    }

    // Check if a comment already exists
    const { data: comments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
    })

    const existing = comments.find((comment) =>
      comment.body?.includes('<!-- lighthouse-comment -->')
    )

    if (existing) {
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existing.id,
        body: commentBody,
      })
    } else {
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: commentBody,
      })
    }

    core.info('✅ Lighthouse comment posted.')
  } catch (error) {
    core.setFailed(`❌ ${error instanceof Error ? error.message : error}`)
  } finally {
    if (chrome) await chrome.kill()
  }
}

run()
