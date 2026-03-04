# 项目复盘（v1 / v2）

日期：2026-03-04  
仓库：`bcl200n/Amd-cloudproject`

## 1. 项目目标

本项目基于 AI Town 中文化改造，目标是实现：

- 在云服务器稳定运行（可固化部署、可运维）
- 支持本地模型推理（Ollama + Qwen2/BGE）
- 支持中英文界面
- 支持多智能体交互可观测（事件、统计、回放分析）
- 支持后续规模扩展（200 -> 1000 -> 3000+）

## 2. 版本划分

## v1（基础可运行 + 稳定化阶段）

### 2.1 主要能力

- 中文化可用，基础页面和交互可正常运行
- 修复“网页可打开但看不到 agents”问题
- Embedding 长输入防护和失败降级，减少流程中断
- 增加运维文档，固定 systemd + nginx + caddy 的服务化运行
- 引入初步扩展性优化：
  - 单 tick 限制活跃 agent 预算（避免全量 agent 每 tick 全跑）
  - 全局 LLM 并发保护（降低推理拥塞）

### 2.2 v1 关键提交（主线）

- `c893e21` 中文化
- `df99cb1` agent 可见性修复 + embedding 稳定性增强
- `6c9e60a` 运维手册与部署状态文档
- `eb08f72` 规模化基础优化（agent budget + LLM 并发守卫）

### 2.3 v1 成果

- 服务端可长期运行，不再频繁“看得到页面看不到 agent”
- 故障定位路径明确（服务状态、日志、健康检查）
- 为大规模 agent 和事件分析做了基础准备

## v2（事件系统 + 可观测 + 双语 + 可视化阶段）

### 3.1 主要能力

- 增加 `socialEvents` 行为事件表（对话、邀请、消息、操作等）
- 增加行为统计查询（近期事件、交互摘要）
- 新增世界事件能力：
  - `earthquake`（短周期）
  - `city_update`（长周期）
- 新增自动调度表 `worldEventSchedules`，支持双周期自动触发和自动结束
- 新增事件窗口交互统计：
  - 地震窗口统计
  - 城市更新窗口统计
- 新增前端中英文切换（可记忆）
- 新增前端“世界事件面板”：
  - 当前状态（进行中/未激活）
  - 开始/结束/下次触发时间
  - 窗口内交互数量
  - Top 类型 / Top actors / Top dyads

### 3.2 v2 关键提交（主线）

- `53354ce` social event 埋点与分析查询
- `2afeb6b` 地震事件触发与统计
- `8f263cc` 双周期事件（地震 + 城市更新）自动调度
- `7b7e2fe` 中英文 UI 切换
- `bb3f6f0` 事件监控面板 + v2 release 文档

### 3.3 v2 数据与接口（核心）

- 表：
  - `socialEvents`
  - `worldEvents`
  - `worldEventSchedules`
- 关键函数：
  - `worldEvents:worldEventSchedule`
  - `worldEvents:configureWorldEventSchedule`
  - `worldEvents:currentWorldEvents`
  - `worldEvents:earthquakeInteractionSummary`
  - `worldEvents:cityUpdateInteractionSummary`
  - `worldEvents:triggerEarthquake`
  - `worldEvents:triggerCityUpdate`

## 4. 当前部署形态（推荐）

### 服务拓扑

- `ai-town-convex-backend.service`：Convex backend（本地）
- `ai-town-convex-sync.service`：函数同步执行
- `ai-town-ollama.service`：本地推理
- `ai-town-frontend-build.service`：前端构建到 `/var/www/ai-town`
- `nginx`：静态与反代入口
- `caddy`：公网反向代理

参考：`docs/OPERATIONS.md`

## 5. 新机器部署简版

```bash
git clone https://github.com/bcl200n/Amd-cloudproject.git
cd Amd-cloudproject
git checkout v2
npm install
npm run build
```

之后按你的生产方式启动（systemd/nginx/caddy，或开发模式）。

## 6. 回滚策略

```bash
# 回到某个稳定提交/标签（本地）
git checkout <tag-or-commit>

# 若需要生产回滚，再按你的发布流程重新构建并重启服务
```

建议：生产环境固定使用 tag（例如 `v2`），不要直接追 `main`。

## 7. 后续路线（建议）

- 事件面板加入时间序列图（分钟级/5分钟级趋势）
- 统计层加入 DB 聚合缓存，降低大窗口扫描成本
- 为 1000+ agent 引入分片 world（多 world 并行）与压测基线
