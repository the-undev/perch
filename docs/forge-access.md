# Forge access

Perch reads GitHub and Forgejo with read-only tokens kept in the desktop
keyring. Each source card names an account and a keyring key, usually
`github-<account>` or `forgejo-<account>`.

## GitHub

Create one fine-grained token per account or organisation, under Settings,
Developer settings, Personal access tokens.

- Resource owner: the account itself.
- Repository access: All repositories.
- Expiry: GitHub caps it at one year.
- Repository permissions, all read-only: Metadata, Contents, Pull requests,
  Actions.

A token covers one resource owner. An organisation's private repositories
need their own token, with the organisation as resource owner.

## Forgejo

Create one token per account, under Settings, Applications. Scopes:
`read:repository`, `read:issue` and `read:user`.

## Storing and replacing

Paste the token into the source card on the settings page and press Store in
the keyring. Or run this, which prompts for the token:

```sh
secret-tool store --label "perch github <account>" service perch key github-<account>
```

Check an entry with `secret-tool lookup service perch key <name>`.

To replace a token, store it again. Perch uses the new value on the next
scan.
