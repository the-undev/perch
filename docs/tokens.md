# Tokens

How perch's read-only forge tokens are created, stored and replaced. The
scheme: keyring only, read-only everywhere, no `gh`, no password manager
at run time, as the spec's Secrets section sets out.

Each source card names an account and a keyring key. The key is
conventionally `<kind>-<account>`, such as `github-<account>` or
`forgejo-<account>`; any name works as long as each is used once per kind.

## GitHub

One fine-grained personal access token per account or organisation a
card reads. Create at Settings, Developer settings, Personal access
tokens, Fine-grained tokens:

- Resource owner: the account itself.
- Repository access: All repositories.
- Expiry: GitHub caps at one year; record the renewal date beside the
  token's backup copy.
- Repository permissions, all Read-only: Metadata (added automatically),
  Contents, Pull requests, Actions. Everything else No access.

A fine-grained token covers one resource owner. Private repositories
under an organisation are not readable with a token scoped to a personal
account, so an organisation's card needs its own token with the
organisation as resource owner and the same permissions.

## Forgejo

One token per account, because a token reads only its own account's
private repos. Create each at Settings, Applications, Generate New
Token, with scopes `read:repository`, `read:issue` (pull requests sit
under it) and `read:user`.

## Storing

From the app: open the source's card on the settings Sources page, paste
the token into its token field and press Store in the keyring. It goes
under the card's keyring key, and Test then lists the account's
repositories with it. The field is write-only: perch never shows a
stored token.

From a terminal, the command prompts for the token, so it never enters
shell history:

```bash
secret-tool store --label "perch github <account>" service perch key github-<account>
```

Verify one with `secret-tool lookup service perch key <name>`, which
prints the token. Keep a human backup copy of each token outside the
keyring.

## Replacing

Regenerate the token on the forge with the scopes needed, then store it
again from the card or with the same `secret-tool store` command; either
overwrites the entry. perch picks the
new value up on the next scan. A scope that is too narrow shows up as a
source error naming the failing call.
