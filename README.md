# 🔦 Lighthouse PR Commenter for Vercel

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

      - name: Wait for Vercel preview to be ready
        id: wait-for-vercel
        uses: patrickedqvist/wait-for-vercel-preview@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          max_timeout: 180
          check_interval: 10

      - name: Run Lighthouse and comment on PR
        uses: robbiecren07/lighthouse-vercel-action@v1
        with:
          vercel_url: ${{ steps.wait-for-vercel.outputs.url }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

### 🛠 Inputs

| Name           | Required | Description                                   |
|----------------|----------|-----------------------------------------------|
| `vercel_url`   | ✅       | The deployed Vercel Preview URL to audit      |
| `github_token` | ✅       | GitHub token to post or update the PR comment |


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

### 📋 License

MIT © Robbie Crenshaw