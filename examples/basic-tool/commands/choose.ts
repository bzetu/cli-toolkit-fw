import { defineCommand } from "../../../src/core/define"

export const chooseCommand = defineCommand({
  id: "basic.choose",
  name: "choose",
  title: "选择示例",
  description: "演示方向键选择和确认",
  run() {
    return {
      output: "请选择一个项目：",
      selection: {
        title: "示例项目",
        options: [
          { id: "a", title: "示例 A", description: "第一个选项" },
          { id: "b", title: "示例 B", description: "第二个选项" },
        ],
        onSelect(option) {
          return { output: `已选择：${option.title}`, tone: "success" }
        },
      },
    }
  },
})
