# OpenArti

## 文档

所有项目文档维护在 OpenArti collection `glance2life/openarti`，不在仓库里：

- `overview.md` — 项目简介和快速开始
- `spec.md` — 产品规格：Web / CLI / MCP / REST 接口
- `architecture.md` — 存储引擎、schema、部署架构
- `self-hosting.md` — 本地开发、Docker Compose、云部署
- `deploy-saas.md` — openarti.com 生产部署手册（私有）
- `cli.md` — arti CLI 完整用法

读写文档：`arti read glance2life/openarti/<file>` / `arti write glance2life/openarti/<file>`

## 云端部署

- **Vercel** — team: `glance2life-7797s-projects` (`team_QrvUQ8c1qWBPEGv4WeQD2Njb`)；push main 自动触发两个项目的部署
  - `openarti-web` (`prj_vg0Ap9gHokO4mbU8CnIaO46Pj65u`)
  - `openarti-api` (`prj_Q3UAMT4b8mbTWXLiZREuj4MXMUTf`)
- **Supabase** — MCP 已连接，数据库在 `public` schema

## 本地开发

- PostgreSQL 跑在 Docker：`docker exec docker-postgres-1 psql -U openarti -d openarti -c "SQL"`
