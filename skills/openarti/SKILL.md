---
name: openarti
description: Interact with OpenArti repositories using the arti CLI. Use when the user references OpenArti, the arti CLI, or resources at openarti.dev — for example reading, writing, searching, or browsing files in an OpenArti repo.
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
├── read <owner/repo/path>          Read a file
├── write <owner/repo/path>         Write a file (stdin)
├── edit <owner/repo/path>          Edit a file (string replacement)
├── rm <owner/repo/path>            Delete a file
├── ls <owner/repo> [path]          List directory
├── grep <pattern> <owner/repo>     Search file content
├── glob <pattern> <owner/repo>     Find files by pattern
├── log <owner/repo> [path]         Commit history
├── diff <owner/repo> [path]        Compare versions
├── blame <owner/repo/path>         Line-by-line authorship
└── repo
    ├── create <team/name>          Create a repository
    └── list <team>                 List repositories
```

Global options: `--token <token>`, `--endpoint <url>`

## Commands

### read

Read file content from a repository.

```bash
arti read owner/repo/path/to/file.md
arti read owner/repo/file.md --offset 10 --limit 50
arti read owner/repo/file.md --ref abc1234
```

Options: `--offset <n>` start line, `--limit <n>` line count, `--ref <commit>` specific version.

### write

Write a file. Content is read from stdin.

```bash
echo "# Hello" | arti write owner/repo/README.md -m "init readme"
cat draft.md | arti write owner/repo/docs/guide.md -m "add guide"
```

Options: `-m, --message <msg>` commit message.

### edit

Edit a file by replacing a string.

```bash
arti edit owner/repo/config.json --old '"debug": false' --new '"debug": true' -m "enable debug"
arti edit owner/repo/main.py --old old_func --new new_func --replace-all -m "rename function"
```

Options: `--old <string>` (required), `--new <string>` (required), `--replace-all`, `-m, --message <msg>`.

### rm

Delete a file from a repository.

```bash
arti rm owner/repo/obsolete.md -m "remove obsolete doc"
```

Options: `-m, --message <msg>` commit message.

### ls

List files and directories. Directories have a trailing `/`.

```bash
arti ls owner/repo
arti ls owner/repo src/lib
```

### grep

Search file content. Output format: `file:line:text`.

```bash
arti grep "TODO" owner/repo
arti grep "error" owner/repo --glob "*.log" -i
arti grep "pattern" owner/repo -C 3
```

Options: `--glob <pattern>` filter files, `-i, --ignore-case`, `-C, --context <n>` context lines.

### glob

Find files matching a glob pattern.

```bash
arti glob "*.md" owner/repo
arti glob "src/**/*.ts" owner/repo
```

### log

View commit history.

```bash
arti log owner/repo
arti log owner/repo README.md --limit 5
```

Output format: `hash date author  message`

Options: `--limit <n>` max commits.

### diff

Compare versions. Outputs unified diff with stats.

```bash
arti diff owner/repo
arti diff owner/repo src/index.ts --from abc1234 --to def5678
```

Options: `--from <commit>`, `--to <commit>`.

### blame

Show line-by-line authorship.

```bash
arti blame owner/repo/src/main.ts
```

Output format: `hash (author date) line| text`

### repo create

Create a new repository.

```bash
arti repo create team/my-repo
arti repo create team/my-repo --description "Project docs" --visibility public
```

Options: `--description <desc>`, `--visibility <private|public>` (default: private).

### repo list

List repositories for a team.

```bash
arti repo list team
```
