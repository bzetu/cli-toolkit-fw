import { defineTool } from "../../src/core/define"
import { chooseCommand } from "./commands/choose"
import { listCommand } from "./commands/list"

/** Documentation example only. It is not registered by default. */
export default defineTool({
  id: "basic",
  title: "基础示例",
  description: "演示表格、列表选择和命令注册",
  onEnter() {
    return { output: "已进入基础示例工具。", tone: "muted" }
  },
  commands: [listCommand, chooseCommand],
})
