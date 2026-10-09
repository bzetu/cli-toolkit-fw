export function usageText(name: string): string {
  return `${name} - 可交互的本地 CLI 工具集合框架

用法：
  ${name}                          进入交互式终端界面
  ${name} server start             以 MCP stdio 服务器模式运行（供 AI 客户端调用）
  ${name} server stop              停止本机手动启动的调试实例
  ${name} --run <工具ID> <命令名> [参数...]   单次执行一条命令并输出文本结果
  ${name} --help                   显示本帮助

交互界面说明：
  输入 / 查看当前作用域命令；↑↓ 选择补全项，Tab 或 Enter 补全选中项，
  无补全菜单时按 Enter 执行命令；Esc 关闭菜单或清空输入；/exit 退出。
`
}
