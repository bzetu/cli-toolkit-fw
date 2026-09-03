# cli-toolkit-fw

Current version: `0.2.0`

`cli-toolkit-fw` 是一个可由 AI 协助定制的交互式 CLI 工具集合框架。它保留 OpenCode 风格的输入、命令补全、列表选择、导航、历史输出和鼠标滚动，但运行时不连接 LLM。

用户只需向代码型 AI 描述想要的工具和命令。AI 按照仓库中的 `AGENTS.md` 和 `docs/` 规范生成本地 TypeScript 工具，之后所有操作都由本地代码直接执行。

本仓库只包含通用框架，不包含任何特定服务、账号、额度查询、配置切换或进程管理业务。

## 安装

Windows：

```powershell
powershell -ExecutionPolicy Bypass -File .\install-windows.ps1
```

Linux 或 macOS：

```bash
chmod +x ./install.sh
./install.sh
```

安装时会要求输入命令与 UI 名称，直接回车则使用默认名称 `toolkit`。例如输入 `mytools` 后，启动命令和界面标题都会变成 `mytools`。

安装完成并重新打开终端后，使用安装时选择的名称运行。默认是：

```text
toolkit
```

卸载会删除框架写入的 PATH、环境变量、项目内由安装器生成的 `.cli-toolkit-fw/` 启动器目录和 `node_modules/` 依赖目录；不会删除 Bun、源码、扩展、扩展配置或日志。需要恢复依赖时重新运行安装脚本即可。交互式卸载完成后会等待任意键退出：

```powershell
powershell -ExecutionPolicy Bypass -File .\uninstall-windows.ps1
```

```bash
chmod +x ./uninstall.sh
./uninstall.sh
```

## 让 AI 添加工具

可以直接描述需求：

```text
请阅读 AGENTS.md，在 extensions 文件夹中为这个 CLI 添加一个 Git 工具。
需要 /status、/branches 和 /checkout 命令。
选择分支时使用方向键列表，完成后运行类型检查和测试。
```

详细规则见：

- `docs/CREATE_TOOL.md`
- `docs/EXTENSIONS.md`
- `docs/COMMAND_API.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`
- `docs/TESTING.md`

## 默认交互

- `/tools`：查看并进入已注册工具
- `/help`：显示当前作用域的命令
- `/clear`：清空当前作用域的输出历史
- `/exit`：工具内返回主页，主页退出程序
- `↑` / `↓`：选择命令或列表项
- `Tab`：补全命令
- `Enter`：执行或确认
- `Esc`：关闭选择列表或清空输入
- 鼠标滚轮：滚动历史输出

所有用户扩展必须放在根目录的 `extensions/<工具ID>/` 中，并从 `index.ts` 默认导出工具。框架启动时会自动发现，无需修改注册表。删除某个工具目录后，该工具会在下次启动时消失；删除整个 `extensions/` 后会回到没有业务工具的默认框架状态。

`extensions/` 内的用户工具默认全部被 Git 忽略，仓库只跟踪 `extensions/.gitkeep`。这可以防止本地工具、账号配置和特定机器逻辑被意外推送到远程仓库。

框架默认不提供业务工具。`examples/basic-tool/` 只用于向开发者和 AI 展示正确写法，不会被自动加载。

## 开发验证

```text
bun run typecheck
bun test
```

## 版本管理

项目使用语义化版本：

```text
主版本.次版本.修订版本
```

- 不兼容的框架变化增加主版本。
- 向后兼容的新能力增加次版本。
- 向后兼容的问题修复增加修订版本。

版本号记录在 `package.json`，每个版本的具体变化记录在 `CHANGELOG.md`，正式版本使用 `v<版本号>` Git 标签。

日志位置：

- Windows：`%LOCALAPPDATA%\cli-toolkit-fw\logs\cli-toolkit-fw.log`
- macOS：`~/Library/Logs/cli-toolkit-fw/cli-toolkit-fw.log`
- Linux：`${XDG_STATE_HOME:-~/.local/state}/cli-toolkit-fw/cli-toolkit-fw.log`
