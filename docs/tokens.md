# Tokens

How perch's read-only forge tokens are created, stored and replaced. The
scheme: keyring only, read-only everywhere, no `gh`, no password manager at run
time, as the spec's Secrets section sets out.

## GitHub

One fine-grained personal access token per account, `finch` and
`the-undev`. Create at Settings, Developer settings, Personal access
tokens, Fine-grained tokens:

- Resource owner: the account itself.
- Repository access: All repositories.
- Expiry: GitHub caps at one year; record the renewal date in the
  password manager entry.
- Repository permissions, all Read-only: Metadata (added automatically),
  Contents, Pull requests, Actions. Everything else No access.

`skiff` lives under the `skiff-app` organisation, whose repos are
private (verified 21 October 2026: the-undev's token gets 404 there), so a
fine-grained token scoped to `the-undev` does not cover them. Create one
more token with `skiff-app` as resource owner and the same permissions,
stored under `github-skiff-app`.

## Forgejo

One token per account, `finch` and `the-undev`, because a token reads
only its own account's private repos. Create each at Settings,
Applications, Generate New Token, with scopes `read:repository`,
`read:issue` (pull requests sit under it) and `read:user`.

## Storing

From the app: open the source's card on the settings Sources page, paste
the token into its token field and press Store in the keyring. It goes
under the card's keyring key, and Test then lists the account's
repositories with it. The field is write-only: perch never shows a
stored token.

From a terminal, each command prompts for the token, so it never enters
shell history:

```bash
secret-tool store --label "perch github finch" service perch key github-finch
secret-tool store --label "perch github the-undev" service perch key github-the-undev
secret-tool store --label "perch github skiff-app" service perch key github-skiff-app
secret-tool store --label "perch forgejo finch" service perch key forgejo-finch
secret-tool store --label "perch forgejo the-undev" service perch key forgejo-the-undev
```

Verify one with `secret-tool lookup service perch key <name>`, which
prints the token. The human backup copy of each token lives in a password manager
under Tech.

## Replacing

Regenerate the token on the forge with the scopes needed, then store it
again from the card or with the same `secret-tool store` command; either
overwrites the entry. perch picks the
new value up on the next scan. A scope that is too narrow shows up as a
source error naming the failing call.
