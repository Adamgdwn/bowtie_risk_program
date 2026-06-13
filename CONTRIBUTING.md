# Contributing

Thank you for helping improve Bowtie Risk Builder. The project is meant to make bowtie risk reviews easier to build, explain, and export.

## Good Contribution Areas

- clearer bowtie editor interactions
- better worksheet guidance and validation messages
- export reliability for canvas, worksheet, PNG, and PDF outputs
- Supabase setup documentation and local development ergonomics
- tests for node/edge behavior, import/export, and worksheet sync
- accessibility improvements for diagram editing and inspector panels

## Ground Rules

- Do not commit Supabase keys, Stripe keys, model-provider keys, `.env.local`, or private customer/project data.
- Keep AI-generated suggestions reviewable and non-authoritative.
- Preserve the distinction between deterministic fallback suggestions and provider-backed model behavior.
- Document changes that affect auth, billing, data storage, exports, or risk-review terminology.
- Keep exported examples sanitized and generic.

## Development Checks

Run the checks that match your change. For general changes:

```bash
npm run lint
npm run build
git diff --check
```

If a check is unavailable on your machine, mention that in the pull request.

## Pull Requests

Please describe:

- what changed
- which risk-review workflow it improves
- whether the change affects Supabase, Stripe, AI suggestions, or exports
- which checks you ran
- any setup or migration notes

By contributing, you agree that your contribution is provided under the MIT License.
