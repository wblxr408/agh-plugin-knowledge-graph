# 知识图谱 · Knowledge Atlas

这个市场版本提供 AGH 配置 Bundle。知识图谱的实际运行功能由独立组件 `@wblxr408/knowledge-graph-runtime` 提供。

## 安装

1. 安装经固定提交发布的运行组件。在 AGH 中审核其权限，再信任和启用。

   ```sh
   agh plugins add git:https://github.com/wblxr408/agh-plugin-knowledge-graph#dc1b971aa8d2019548a94b1df3ef924cb3a9932d
   ```

2. 在 AGH 市场安装并启用 `@wblxr408/knowledge-graph` 2.0.0。从 AGH 侧栏打开知识图谱，并按运行组件的说明准备本地 Quartz 数据。

市场包的智能体入口提供只读配置说明。实际界面由运行组件注册。

如果已安装本仓库的旧版插件，请先用市场 Bundle 更新旧版，再安装新的运行组件，避免同一功能同时加载两个版本。

[运行组件文档](https://github.com/wblxr408/agh-plugin-knowledge-graph/tree/runtime-v1.1.3) · [AGH 插件安装指南](https://github.com/AgnesAI-Labs/agnes-harness/blob/main/docs/guide/packages.zh-CN.md)
