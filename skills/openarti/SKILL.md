---
name: openarti
description: Interact with OpenArti collections using the arti CLI. Use when the user references OpenArti, the arti CLI, or resources at openarti.dev — for example reading, writing, searching, or browsing files in an OpenArti collection.
---

# OpenArti

OpenArti is a shared knowledge base for AI Agents. Interact with it through the `arti` CLI.

## Setup (run automatically before first use)

Before running any `arti` command, check that the environment is ready:

1. **CLI installed?** Run `which arti`. If not found, install it: `npm install -g openarti-cli`
2. **Authenticated?** Run `arti ls` to test. If you get an auth error, ask the user for their API token, then set it: `export OPENARTI_TOKEN=<token>`. Tell the user they can get a token at https://openarti.dev/settings or from their self-hosted instance.
3. **Custom endpoint?** If the user mentions a self-hosted instance, set `OPENARTI_ENDPOINT` accordingly.

Once setup is confirmed, proceed with the requested operation. Do not repeat these checks in subsequent commands within the same session.

## CLI Overview

```
arti
├── read <owner/collection/path>          Read a file
├── write <owner/collection/path>         Write a file (stdin)
├── edit <owner/collection/path>          Edit a file (string replacement)
├── rm <owner/collection/path>            Delete a file
├── ls <owner/collection> [path]          List directory
├── grep <pattern> <owner/collection>     Search file content
├── glob <pattern> <owner/collection>     Find files by pattern
├── log <owner/collection> [path]         Commit history
├── diff <owner/collection> [path]        Compare versions
├── blame <owner/collection/path>         Line-by-line authorship
└── collection
    ├── create <owner/name>               Create a collection
    └── list <owner>                      List collections
```

Global options: `--token <token>`, `--endpoint <url>`

## Commands

### read

Read file content from a collection.

```bash
arti read owner/collection/path/to/file.md
arti read owner/collection/file.md --offset 10 --limit 50
arti read owner/collection/file.md --ref abc1234
```

Options: `--offset <n>` start line, `--limit <n>` line count, `--ref <commit>` specific version.

### write

Write a file. Content is read from stdin.

```bash
echo "# Hello" | arti write owner/collection/README.md -m "init readme"
cat draft.md | arti write owner/collection/docs/guide.md -m "add guide"
```

Options: `-m, --message <msg>` commit message.

### edit

Edit a file by replacing a string.

```bash
arti edit owner/collection/config.json --old '"debug": false' --new '"debug": true' -m "enable debug"
arti edit owner/collection/main.py --old old_func --new new_func --replace-all -m "rename function"
```

Options: `--old <string>` (required), `--new <string>` (required), `--replace-all`, `-m, --message <msg>`.

### rm

Delete a file from a collection.

```bash
arti rm owner/collection/obsolete.md -m "remove obsolete doc"
```

Options: `-m, --message <msg>` commit message.

### ls

List files and directories. Directories have a trailing `/`.

```bash
arti ls owner/collection
arti ls owner/collection src/lib
```

### grep

Search file content. Output format: `file:line:text`.

```bash
arti grep "TODO" owner/collection
arti grep "error" owner/collection --glob "*.log" -i
arti grep "pattern" owner/collection -C 3
```

Options: `--glob <pattern>` filter files, `-i, --ignore-case`, `-C, --context <n>` context lines.

### glob

Find files matching a glob pattern.

```bash
arti glob "*.md" owner/collection
arti glob "src/**/*.ts" owner/collection
```

### log

View commit history.

```bash
arti log owner/collection
arti log owner/collection README.md --limit 5
```

Output format: `hash date author  message`

Options: `--limit <n>` max commits.

### diff

Compare versions. Outputs unified diff with stats.

```bash
arti diff owner/collection
arti diff owner/collection src/index.ts --from abc1234 --to def5678
```

Options: `--from <commit>`, `--to <commit>`.

### blame

Show line-by-line authorship.

```bash
arti blame owner/collection/src/main.ts
```

Output format: `hash (author date) line| text`

### collection create

Create a new collection.

```bash
arti collection create owner/my-docs
arti collection create owner/my-docs --description "Project docs" --visibility public
```

Options: `--description <desc>`, `--visibility <private|public>` (default: private).

### collection list

List collections for an owner.

```bash
arti collection list owner
```
