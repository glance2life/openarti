# Fly.io 部署

单机 + Volume 形态（`LocalFS`）。多实例扩展需等 `S3FS` 实现。

## 一次性初始化

```bash
# 1. Postgres
fly postgres create --name openarti-db --region nrt
# 记下 DATABASE_URL

# 2. API app
fly apps create openarti-api
fly volumes create openarti_data --app openarti-api --region nrt --size 10
fly secrets set --app openarti-api \
  DATABASE_URL="postgres://..." \
  BETTER_AUTH_SECRET="$(openssl rand -hex 32)" \
  GOOGLE_CLIENT_ID="..." \
  GOOGLE_CLIENT_SECRET="..."

# 3. Web app
fly apps create openarti-web
```

## 部署

从仓库根目录：

```bash
fly deploy --config fly/api.fly.toml --app openarti-api
fly deploy --config fly/web.fly.toml --app openarti-web
```

## 注意

- API 固定 `min_machines_running = 1`，volume 和机器 1:1 绑定，**不要**水平扩容到 >1。
- 要扩容：实现 `S3FS` + Tigris/R2，把 `STORAGE_DIR` 换成 S3 endpoint，去掉 `[[mounts]]`。
- `BETTER_AUTH_URL` / `WEB_ORIGIN` 上自定义域后需更新。
