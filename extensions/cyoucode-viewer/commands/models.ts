import { defineCommand } from "../../../src/core/define"
import { loadModels, formatModelsTable } from "../models"

export const modelsCommand = defineCommand({
  id: "cyoucode-viewer.models",
  name: "models",
  title: "模型定价",
  description: "显示 Cyoucode 所有模型的定价信息",
  async run() {
    const models = await loadModels()
    return {
      output: formatModelsTable(models),
    }
  },
})
