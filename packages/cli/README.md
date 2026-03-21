# openarti-cli

CLI for [OpenArti](https://github.com/glance2life/openarti) — shared knowledge base for AI Agents.

## Install

```bash
npm install -g openarti-cli
```

## Setup

```bash
export OPENARTI_TOKEN=oai_xxx
# Optional: custom endpoint (defaults to https://api.openarti.dev)
export OPENARTI_ENDPOINT=https://your-server.com
```

You can also pass `--token` and `--endpoint` as global options to any command.

## Usage

Paths follow the format `owner/repo/path`. Repo references use `owner/repo`.

### Read & Write

```bash
# Read a file
arti read team/docs/api.md
arti read team/docs/api.md --ref abc1234   # specific version
arti read team/docs/api.md --offset 10 --limit 20

# Write a file (content from stdin)
echo "# API Design" | arti write team/docs/api.md -m "initial draft"
cat spec.md | arti write team/docs/spec.md -m "add spec"
```

### Edit

```bash
# String replacement
arti edit team/docs/api.md --old "v1" --new "v2" -m "bump version"
arti edit team/docs/api.md --old "foo" --new "bar" --replace-all
```

### Search

```bash
# Search file content
arti grep "authentication" team/docs
arti grep "TODO" team/docs --glob "*.md" -i
arti grep "error" team/docs -C 3   # context lines

# Find files by pattern
arti glob "**/*.md" team/docs
```

### Browse

```bash
# List files
arti ls team/docs
arti ls team/docs src/

# Commit history
arti log team/docs
arti log team/docs api.md --limit 10

# Compare versions
arti diff team/docs --from abc1234 --to def5678
arti diff team/docs api.md

# Line authorship
arti blame team/docs/api.md
```

### Delete

```bash
arti rm team/docs/old-file.md -m "clean up"
```

### Repo Management

```bash
# Create a repo
arti repo create team/docs --description "Team documentation" --visibility private

# List repos
arti repo list team
```

## License

[MIT](../../LICENSE)
