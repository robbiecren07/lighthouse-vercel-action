# 🔦 Lighthouse PR Commenter for Vercel

[![GitHub Marketplace](https://img.shields.io/badge/GitHub%20Marketplace-Lighthouse%20Action-blue?logo=github)](https://github.com/marketplace/actions/lighthouse-pr-commenter-for-vercel)

Automatically runs a Lighthouse audit against your Vercel preview deployment and posts the results as a comment on the related pull request.

> Ideal for performance monitoring on every PR — without needing 3rd-party tools.

---

### 🚀 Features

- 📊 Audits **Performance**, **Accessibility**, **Best Practices**, and **SEO**
- 🧪 Uses **Lighthouse mobile config** with throttling **disabled** for real-world results
- 🧵 Posts a PR comment and **updates it on each push**
- 🔍 Designed to work specifically with **Vercel preview deployments**
- ⚙️ Easy to configure and extend

---

### 📦 Usage

Add the following to your GitHub repo’s `.github/workflows/lighthouse.yml`:

```yaml
name: Lighthouse Audit on PR

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  lighthouse:
    name: Run Lighthouse on Vercel Preview
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run Lighthouse and comment on PR
        uses: robbiecren07/lighthouse-vercel-action@v1.1.0
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          max_timeout: '120' # optional - defaults to 180 seconds
          check_interval: '20' # optional - defaults to 10 seconds

```

> **⚠️ Important:** If the action fails try increaseing the `max_timeout`.

### 🛠 Inputs

| Name             | Required | Description                                                          |
| ---------------- | -------- | -------------------------------------------------------------------- |
| `github_token`   | ✅        | GitHub token to authenticate and post or update the PR comment       |
| `max_timeout`    | ❌        | Max time (in seconds) to wait for Vercel deployment (default: `180`) |
| `check_interval` | ❌        | Time (in seconds) between deployment status checks (default: `10`)   |


### 🧪 Example Output

Once a PR is created, you’ll get a comment like:

⚡ Lighthouse Mobile Audit

| Category           | Score |
|--------------------|-------|
| ⚡ Performance      | 88    |
| ♿ Accessibility    | 100   |
| 🔐 Best Practices  | 100   |
| 🔍 SEO             | 92    |

> Audited [Preview URL](https://your-app--feature-branch.vercel.app)
