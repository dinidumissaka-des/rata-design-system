# Claude review and auto-merge

Two workflows, both using [`anthropics/claude-code-action@v1`](https://github.com/anthropics/claude-code-action):

| Workflow | Runs on | Does |
|---|---|---|
| `workflows/claude-review.yml` | every non-draft PR from a branch in this repo, on each push | Reviews the diff against `CLAUDE.md`, posts inline comments and one summary, and returns a verdict. **approve** → GitHub auto-merge is enabled (merge commit), and GitHub merges once every required check is green. **request_changes** → the `review` check fails and the PR waits for you. |
| `workflows/claude.yml` | `@claude` in an issue, PR comment or PR review, from someone with write access | Answers, or pushes fixes to the PR's branch. Never merges. |

The model never runs a merge command. A plain workflow step reads its
structured verdict and runs `gh pr merge --auto --merge`, and auto-merge is
switched off at the start of every review, so an approval never carries over to
a push that hasn't been reviewed.

## One-time setup

1. **Token.** Run `claude setup-token` locally (needs a Claude Pro/Max/Team/Enterprise
   plan), then add the result as a repository secret named
   `CLAUDE_CODE_OAUTH_TOKEN`: Settings → Secrets and variables → Actions →
   New repository secret.
2. **Install the Claude GitHub App** on this repository:
   https://github.com/apps/claude. The action uses it to post as Claude.
3. **Allow auto-merge:** Settings → General → Pull Requests → *Allow auto-merge*.
4. **Protect `main`:** Settings → Branches (or Rules) → add a rule for `main` that
   requires status checks to pass, and select **`build`** (CI) and **`review`**
   (Claude review). This is what makes auto-merge wait. Without it,
   `gh pr merge --auto` merges a mergeable PR immediately.

## Things to know

- **Overriding Claude.** When the review requests changes, the required `review`
  check is red. Push a fix (it re-reviews), or, as an admin, merge with the
  branch-protection bypass.
- **Forks** get no secrets, so their PRs are not reviewed. Review those by hand.
- **CI on `main` after an auto-merge.** A merge made with the workflow's
  `GITHUB_TOKEN` doesn't trigger other workflows, so `ci.yml`'s
  `push: main` run won't fire for it. The PR's own CI run already gated the merge.
- **Turning it off:** disable either workflow under Actions, or untick
  *Allow auto-merge* to keep reviews but stop merging.
