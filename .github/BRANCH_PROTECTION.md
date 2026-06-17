# Branch protection - `main` (FotoGrids Free)

Branch protection is a GitHub repository setting; it lives on the server, not in
this repo. Apply it once via the `gh` CLI script below, or through the web UI.
Re-run the script whenever the set of required checks changes.

Repo: `markrean/fotogrids`

## Required status checks

These names must match the workflow job names **exactly** (matrix legs included).
If a job is renamed, update the required-checks list here and in the settings.

| Check                  | Workflow     |
| ---------------------- | ------------ |
| `JS lint + type-check` | ci.yml       |
| `Jest tests`           | ci.yml       |
| `PHPUnit (7.4)`        | ci.yml       |
| `PHPUnit (8.1)`        | ci.yml       |
| `PHPUnit (8.3)`        | ci.yml       |
| `Build (webpack)`      | ci.yml       |
| `Playwright (wp-env)`  | e2e.yml      |
| `npm audit`            | security.yml |
| `composer audit`       | security.yml |
| `PHP syntax (7.4)`     | lint.yml     |
| `PHP syntax (8.1)`     | lint.yml     |
| `PHP syntax (8.3)`     | lint.yml     |
| `PHP_CodeSniffer`      | lint.yml     |

> A check only becomes selectable in the UI **after it has run at least once**.
> Open a throwaway PR so every workflow runs, then apply protection.

## Option A - `gh` CLI (run locally where you're authenticated)

```bash
gh api -X PUT repos/markrean/fotogrids/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "JS lint + type-check",
      "Jest tests",
      "PHPUnit (7.4)",
      "PHPUnit (8.1)",
      "PHPUnit (8.3)",
      "Build (webpack)",
      "Playwright (wp-env)",
      "npm audit",
      "composer audit",
      "PHP syntax (7.4)",
      "PHP syntax (8.1)",
      "PHP syntax (8.3)",
      "PHP_CodeSniffer"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true
  },
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true,
  "restrictions": null
}
JSON
```

Notes:

- `strict: true` requires a branch to be up to date with `main` before merge.
- `enforce_admins: false` lets you bypass in a real emergency; set `true` to bind admins too.
- Solo maintainer? Drop the `required_pull_request_reviews` block, or set the count to `0`.

## Option B - Web UI

Settings → Branches → Add branch ruleset (or "Add rule") for `main`:

1. **Require a pull request before merging** → 1 approval, dismiss stale approvals.
2. **Require status checks to pass** → enable **Require branches to be up to date**, then add every check from the table above.
3. **Require conversation resolution before merging**.
4. **Require linear history**.
5. Leave **force pushes** and **deletions** disabled.
