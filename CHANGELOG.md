# Changelog

This tool adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.1.0

### Added
- Crawl queued hyperdrives for novel keys.
  - Start from current working directory.
  - Ignore `node_modules` and `.git` directories during crawls.
  - Scrape the following files for keys:
    - `.htm` and `.html` &mdash; Hypertext markup documents
    - `.md` and `.markdown` &mdash; Markdown documents
    - `.xml` &mdash; Extensible markup data file
    - `.json` &mdash; JavaScript object notation data file
    - `.js` &mdash; JavaScript script or module
    - `.css` &mdash; Cascading stylesheet
  - Queue mounted directories.
- Check installed version with `--version` (abbr. `-v`) option.
- Mount discovered drives with `--mount` (abbr. `-m`) option.
