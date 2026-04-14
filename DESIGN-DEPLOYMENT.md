# 部署与水平扩展

核心需求是**多个 agent 函数同时 grep/read/write 同一份用户数据**。存储模型是自研的 collection/artifact + weave 版本化（不是 git），通过 `CollectionFS` 接口解耦引擎与底层存储。

两种部署形态：

1. **共享 FS 形态**（POSIX）：serverless 实例全部挂同一份网络盘，代码零改动
   ```
   Serverless 计算 ×N（无状态，按需伸缩）
     ↓ 全部挂载同一个文件系统
   共享 FS（EFS / Azure Files / GCS FUSE / ...）
     /data/<owner>/<collection>/
   ```
2. **对象存储形态**（S3/R2）：实现 `S3FS`，分布式锁走 Redis / DynamoDB / S3 条件写

关键优势：
- **任意实例处理任意请求**，不需要路由层
- **计算和存储独立伸缩**，互不影响
- **引擎代码零改动**，只换 `CollectionFS` 实现

## CollectionFS：可插拔的存储后端

引擎层通过 `CollectionFS` 接口操作文件（`readFile / writeFile / readdir / exists / unlink / mkdir / glob / lock`），不直接调用 `fs.*`。不同部署环境提供不同实现，引擎代码不变：

```
ArtiEngine（不变）
  ↓
CollectionFS
  ├── LocalFS          — 本地开发 / 自托管单机（已实现）
  ├── S3FS / R2FS      — 对象存储（锁走 Redis / DynamoDB / S3 条件写）
  ├── EfsFS            — AWS Lambda + EFS
  ├── AzureFilesFS     — Container Apps + Azure Files
  ├── GcsFuseFS        — Cloud Run + GCS FUSE
  ├── ModalFS          — Modal Volumes
  └── FlyVolumeFS      — Fly Machines + Volume
```

## 云平台对比

| 方案 | 多实例共享 | POSIX 兼容 | 缩容到零 | 锁定程度 |
|------|----------|-----------|---------|---------|
| Lambda + EFS | 原生 | 完整 NFS | 是 | AWS |
| Modal Volumes | 需 commit | 有限 | 是 | Modal |
| Cloud Run + FUSE | 是 | 受限 | 是 | GCP |
| Container Apps + Azure Files | 原生 | 完整 NFS | 是 | Azure |
| Fly Machines + Volume | 1:1 绑定 | 本地盘 | 可停机 | Fly |

通过 `CollectionFS` 抽象，不锁定任何单一云平台。
