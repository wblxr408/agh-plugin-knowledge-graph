# AGH 知识图谱

在 AGH 中采用本应用后，从首页侧栏打开「知识图谱」。[Quartz v4.2.4](https://github.com/jackyzha0/quartz/releases/tag/v4.2.4) 解析 Obsidian 风格的内部链接并生成索引。默认视图用 D3 的正射投影绘制可旋转的球形图谱，显示前六级目录及其文件。可以选 4、5 或 6 级，也可以点「全部」查看更深的目录。球体和图例按课程分支着色，点选目录后可继续向下浏览。可用方向键旋转或用加减键缩放，也可以切换回 Quartz 平面图。文件名、路径和已提取的正文均可搜索，无需模型账号。

图谱的边表示目录收录关系或原文中可解析的内部链接。目录中的材料会以节点保留，正文提取支持 PDF 文本层、DOCX、PPTX、XLSX、Markdown、TXT、CSV、TSV、TeX 和 reStructuredText。PDF 提取前 8 页，每份文件保留最多 12,000 个字符。扫描件、图片、旧版 Office 和其他二进制文件仍可按文件名或路径查找。导入跳过版本库、依赖目录和符号链接。原始文件留在原目录。

## 准备与导入

使用项目配置的 Node 24 和 Python 3.11+，从本插件仓库根目录运行下面的 PowerShell 命令。如果 Node 和 Python 不在当前 PATH，用 `-Node` 和 `-Python` 传入可执行文件的完整路径。

```powershell
$plugin = $PWD.Path
& "$plugin/setup.ps1"
& "$plugin/generate.ps1" -Source 'C:\path\to\your\notes'
```

`setup.ps1` 下载完整的 Quartz 发布源、按其锁文件安装依赖，并生成插件的浏览器模块和许可证合集。导入完成后，索引保存在 `%LOCALAPPDATA%\AgnesKnowledgeGraph\atlas.json`。索引包含文件名、相对路径和正文摘录，适合放在自己的本地 AGH 实例里。可在启动 AGH 与运行导入前设置同一个绝对路径 `AGH_ATLAS_DATA_DIR`。更新笔记后重新运行 `generate.ps1`，然后刷新页面。

## 在 AGH 中使用

使用支持应用采纳的 AGH。更新插件时保留当前 profile 和图谱数据目录。部署配置须允许 `ui` 和 `services`。

1. 在当前 AGH 实例中打开 **插件**。如果已安装 `1.1.3`，选择 **从新来源更新**，并提供已审阅的新版本来源。验证候选版时可用本地目录。也可运行 `agh plugins add <新版本来源>` 安装或更新。核对来源和版本后，确认信任并启用。无需卸载旧版或重新导入资料。
2. 打开 **设置 → 应用**。预览候选应用，核对「知识图谱」导航入口和已安装的版本（本次兼容更新为 `1.1.4`），再点击 **采用**。安装、信任和启用都不会开放页面。每个 profile 同时只能采用一个应用。采用本应用会替换当前应用选择，但不会接管官方界面角色。
3. 从首页侧栏打开 **知识图谱**，或使用原书签 `/?page=knowledge.atlas`。如需清除应用选择，访问 `/?admin` 并点击 **恢复官方界面**。恢复后原书签不再开放，图谱数据仍在原目录。

若只需在本机浏览，可运行 `node "$plugin/preview.mjs"`，打开 [本机预览](http://127.0.0.1:4395/)。

## 上游代码与许可证

- [Quartz v4.2.4](https://github.com/jackyzha0/quartz/tree/v4.2.4)，MIT。使用原生 ContentIndex、Obsidian 链接转换器和基于 D3 的 SVG 图谱。浏览器适配将输入和导航接入 AGH，限制 DOM 作用域，并补上键盘操作和卸载清理。构建时将 Quartz 与实际打包的依赖许可证写入 `dist/QUARTZ-NOTICES.txt`。
- 正文解析依赖 [pypdfium2](https://github.com/pypdfium2-team/pypdfium2)、[python-docx](https://github.com/python-openxml/python-docx)、[python-pptx](https://github.com/scanny/python-pptx) 和 [openpyxl](https://openpyxl.readthedocs.io/en/stable/)，通过 `requirements.txt` 独立安装。
- 插件适配代码采用 Apache-2.0，参见 [LICENSE](LICENSE)。
