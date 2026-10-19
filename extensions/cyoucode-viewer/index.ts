import { defineTool } from "../../src/core/define"
import { modelsCommand } from "./commands/models"
import { statusCommand } from "./commands/status"

export default defineTool({
  id: "cyoucode-viewer",
  title: "Cyoucode Viewer",
  description: "查看 Cyoucode 模型定价与使用状态",
  onEnter() {
    return { output: "已进入 Cyoucode Viewer。输入 /models 查看模型定价，/status 查看使用状态。", tone: "muted" }
  },
  commands: [modelsCommand, statusCommand],
})