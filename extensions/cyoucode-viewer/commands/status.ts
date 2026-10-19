import { defineCommand } from "../../../src/core/define"
import { fetchTeamStatus } from "../status"

export const statusCommand = defineCommand({
  id: "cyoucode-viewer.status",
  name: "status",
  title: "使用状态",
  description: "显示 Cyoucode 个人使用状态与公司排行榜排名",
  async run() {
    return {
      output: await fetchTeamStatus(),
    }
  },
})
