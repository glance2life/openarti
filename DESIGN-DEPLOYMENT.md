# 部署与水平扩展

核心需求是**多个 agent 函数同时 grep/read/write 同一份用户数据**。这本质上是 serverless compute + 共享网络文件系统的经典模型：

```
Serverless 计算 ×N（无状态，按需伸缩）
  ↓ 全部挂载同一个文件系统
共享 FS（EFS / Azure Files / GCS FUSE / ...）
  /data/collections/{owner}/{name}/
```

关键优势：
- **任意实例处理任意请求**，不需要路由层
- **计算和存储独立伸缩**，互不影响
- **代码零改动**，`fs.*` 操作在共享 FS 上原生可用

## CollectionFS：可插拔的存储后端

引擎层通过 `CollectionFS` 接口操作文件，不直接调用 `fs.*`。不同部署环境提供不同实现，引擎代码不变：

```
ArtiEngine（不变）
  ↓
CollectionFS
  ├── LocalFS          — 本地开发 / 自托管单机
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
