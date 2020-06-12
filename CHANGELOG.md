# Changelog

This tool adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added
- Command line flags
  - `--help` flag prints command usage and exits early.
  - `--version` flag prints installed version and exits early.
  - `--endpoint` flag overrides Hyperdrive Daemon gRPC endpoint.
  - `--token` flag overrides Hyperdrive Daemon client token.
- Seed input and queueing
  - Fetch and search inputted HTTP(S) URLs and hypercore URIs for hypercore keys.
  - Add all novel keys to a queue.
  - Keep track of which hyperdrives have already been crawled.
  - Blacklist contents of `node_modules` and `.git`.
  - In hyperdrives, read nad search the following file types for keys:
    - `.htm(l)`
    - `.md`
    - `.json`
    - `.xml`
    - `.js`
    - `.css`
- Detailed crawl status logging
