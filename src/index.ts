import * as core from '@actions/core'
import * as github from '@actions/github'
import lighthouse from 'lighthouse'
import type { Config, Flags, RunnerResult } from 'lighthouse'
import * as chromeLauncher from 'chrome-launcher'
import mobileConfig from 'lighthouse/core/config/lr-mobile-config.js'

// Find successful Vercel preview deployment
async function getVercelPreviewUrl(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  prNumber: number
): Promise<string | null> {
  const pr = await octokit.rest.pulls.get({ owner, repo, pull_number: prNumber })
  const sha = pr.data.head.sha

  const deployments = await octokit.rest.repos.listDeployments({ owner, repo, sha })

  for (const deployment of deployments.data) {
    const statuses = await octokit.rest.repos.listDeploymentStatuses({
      owner,
      repo,
      deployment_id: deployment.id,
    })

    const success = statuses.data.find((s) => s.state === 'success' && s.environment_url)

    if (success?.environment_url) {
      core.info(`Found deployment: ${success.environment_url}`)
      return success.environment_url
    }
  }

  return null
}

// Poll for deployment with timeout
async function waitForVercelUrl(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  prNumber: number,
  maxTimeoutMs = 180000,
  intervalMs = 10000
): Promise<string> {
  const start = Date.now()

  while (Date.now() - start < maxTimeoutMs) {
    const url = await getVercelPreviewUrl(octokit, owner, repo, prNumber)
    if (url) return url

    core.info('Waiting for Vercel preview deployment...')
    await new Promise((res) => setTimeout(res, intervalMs))
  }

  throw new Error('Timed out waiting for Vercel preview deployment.')
}

async function runLighthouseAudit({
  url,
  postComment,
}: {
  url: string
  prNumber: number
  owner: string
  repo: string
  postComment: (body: string) => Promise<void>
}): Promise<void> {
  let chrome: chromeLauncher.LaunchedChrome | undefined

  try {
    // Launch headless Chrome
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

    // Run Lighthouse
    const result = (await lighthouse(url, flags, config)) as RunnerResult
    if (!result || !result.lhr) throw new Error('Lighthouse failed to return a result.')

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

> Audited [Preview URL](${url})

<!-- lighthouse-comment -->
`
    await postComment(commentBody)
  } catch (error) {
    throw new Error(
      `Lighthouse audit failed: ${error instanceof Error ? error.message : String(error)}`
    )
  } finally {
    if (chrome) await chrome.kill()
  }
}

// GitHub Action entrypoint
async function run() {
  try {
    const githubToken = core.getInput('github_token')
    const maxTimeout = parseInt(core.getInput('max_timeout') || '180', 10) * 1000
    const checkInterval = parseInt(core.getInput('check_interval') || '10', 10) * 1000

    const octokit = github.getOctokit(githubToken)
    const { owner, repo } = github.context.repo
    const prNumber = github.context.payload.pull_request?.number

    if (!prNumber) {
      throw new Error('Missing pull request number.')
    }

    const vercelUrl = await waitForVercelUrl(
      octokit,
      owner,
      repo,
      prNumber,
      maxTimeout,
      checkInterval
    )

    core.info(`Found Vercel preview: ${vercelUrl}`)

    await runLighthouseAudit({
      url: vercelUrl,
      prNumber,
      owner,
      repo,
      postComment: async (body: string) => {
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
            body,
          })
        } else {
          await octokit.rest.issues.createComment({
            owner,
            repo,
            issue_number: prNumber,
            body,
          })
        }
      },
    })
  } catch (err) {
    core.setFailed(`${err instanceof Error ? err.message : String(err)}`)
  }
}

run()
