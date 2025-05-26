"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const lighthouse_1 = __importDefault(require("lighthouse"));
const chromeLauncher = __importStar(require("chrome-launcher"));
const lr_mobile_config_js_1 = __importDefault(require("lighthouse/core/config/lr-mobile-config.js"));
// Find successful Vercel preview deployment
async function getVercelPreviewUrl(octokit, owner, repo, prNumber) {
    const pr = await octokit.rest.pulls.get({ owner, repo, pull_number: prNumber });
    const sha = pr.data.head.sha;
    const deployments = await octokit.rest.repos.listDeployments({ owner, repo, sha });
    for (const deployment of deployments.data) {
        const statuses = await octokit.rest.repos.listDeploymentStatuses({
            owner,
            repo,
            deployment_id: deployment.id,
        });
        const success = statuses.data.find((s) => s.state === 'success' && s.environment_url);
        if (success?.environment_url) {
            core.info(`Found deployment: ${success.environment_url}`);
            return success.environment_url;
        }
    }
    return null;
}
// Poll for deployment with timeout
async function waitForVercelUrl(octokit, owner, repo, prNumber, maxTimeoutMs = 180000, intervalMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < maxTimeoutMs) {
        const url = await getVercelPreviewUrl(octokit, owner, repo, prNumber);
        if (url)
            return url;
        core.info('Waiting for Vercel preview deployment...');
        await new Promise((res) => setTimeout(res, intervalMs));
    }
    throw new Error('Timed out waiting for Vercel preview deployment.');
}
async function runLighthouseAudit({ url, postComment, }) {
    let chrome;
    try {
        // Launch headless Chrome
        chrome = await chromeLauncher.launch({
            chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu'],
        });
        const flags = {
            port: chrome.port,
            output: ['json'],
            logLevel: 'info',
            onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        };
        const config = {
            ...lr_mobile_config_js_1.default,
            settings: {
                ...lr_mobile_config_js_1.default.settings,
                throttlingMethod: 'provided',
            },
        };
        // Run Lighthouse
        const result = (await (0, lighthouse_1.default)(url, flags, config));
        if (!result || !result.lhr)
            throw new Error('Lighthouse failed to return a result.');
        const { lhr } = result;
        const getScore = (category) => category?.score != null ? Math.round(category.score * 100) : -1;
        const scores = {
            performance: getScore(lhr.categories.performance),
            accessibility: getScore(lhr.categories.accessibility),
            bestPractices: getScore(lhr.categories['best-practices']),
            seo: getScore(lhr.categories.seo),
        };
        const formatScore = (score) => (score >= 0 ? `${score}` : '⚠️ N/A');
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
`;
        await postComment(commentBody);
    }
    catch (error) {
        throw new Error(`Lighthouse audit failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    finally {
        if (chrome)
            await chrome.kill();
    }
}
// GitHub Action entrypoint
async function run() {
    try {
        const githubToken = core.getInput('github_token');
        const maxTimeout = parseInt(core.getInput('max_timeout') || '180', 10) * 1000;
        const checkInterval = parseInt(core.getInput('check_interval') || '10', 10) * 1000;
        const octokit = github.getOctokit(githubToken);
        const { owner, repo } = github.context.repo;
        const prNumber = github.context.payload.pull_request?.number;
        if (!prNumber) {
            throw new Error('Missing pull request number.');
        }
        const vercelUrl = await waitForVercelUrl(octokit, owner, repo, prNumber, maxTimeout, checkInterval);
        core.info(`Found Vercel preview: ${vercelUrl}`);
        await runLighthouseAudit({
            url: vercelUrl,
            prNumber,
            owner,
            repo,
            postComment: async (body) => {
                const { data: comments } = await octokit.rest.issues.listComments({
                    owner,
                    repo,
                    issue_number: prNumber,
                });
                const existing = comments.find((comment) => comment.body?.includes('<!-- lighthouse-comment -->'));
                if (existing) {
                    await octokit.rest.issues.updateComment({
                        owner,
                        repo,
                        comment_id: existing.id,
                        body,
                    });
                }
                else {
                    await octokit.rest.issues.createComment({
                        owner,
                        repo,
                        issue_number: prNumber,
                        body,
                    });
                }
            },
        });
    }
    catch (err) {
        core.setFailed(`${err instanceof Error ? err.message : String(err)}`);
    }
}
run();
