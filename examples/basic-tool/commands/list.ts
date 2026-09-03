import { defineCommand } from "../../../src/core/define"
import { formatTable } from "../../../src/core/table"

export const listCommand = defineCommand({
  id: "basic.list",
  name: "list",
  title: "示例列表",
  description: "显示一张示例表格",
  run() {
    return {
      output: formatTable(
        ["名称", "状态"],
        [
          ["示例 A", "可用"],
          ["示例 B", "停用"],
        ],
      ),
    }
  },
})
