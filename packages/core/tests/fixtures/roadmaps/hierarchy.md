# Roadmap

Planned work for tidewater.

## Release

### Renew the signing key

The key in `release/signing.pem` expires on 30 November.

## Critical

### Sync

- [ ] Data loss when two
  devices save at once
  - seen on Android only so far

## Bugs

### Import

- [x] A CSV with a byte order mark fails to parse
- [ ] Dates read as US format

## Features

### Offline mode

Edits made offline are queued and sent on reconnect.

- [x] Cache the last sync
- [ ] Queue edits while offline
