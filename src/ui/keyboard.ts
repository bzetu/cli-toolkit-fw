export type KeyboardEvent = {
  ctrl: boolean
  name: string
  preventDefault(): void
}

export function handleCtrlC(key: KeyboardEvent, selectedText: string, copy: (text: string) => void) {
  if (!key.ctrl || key.name !== "c") return false
  key.preventDefault()
  if (selectedText) copy(selectedText)
  return true
}

export function handleCtrlA(key: KeyboardEvent, selectAll: () => void) {
  if (!key.ctrl || key.name !== "a") return false
  key.preventDefault()
  selectAll()
  return true
}

export type CompletionEntryLike = { insert: string }

export function completeFromList<T extends CompletionEntryLike>(items: T[], selected: number): T | undefined {
  return items[selected] ?? items[0]
}

export type CommandArgMeta = { name: string; required?: boolean; description?: string }

// 补齐后是否可以直接执行：声明了 args 元数据时，仅当所有声明参数位
// （含可选参数）都已填满才可执行——剩余未填的可选参数位（如 /quota 的
// 金额）要给用户留出输入机会；未声明元数据（meta 为 undefined）时视为
// 可执行，由「补齐后是否还有候选菜单」兜底（如 /tools /help）。
export function isCommandComplete(value: string, meta: CommandArgMeta[] | undefined): boolean {
  if (!meta) return true
  const trimmed = value.trim()
  if (!trimmed.startsWith("/")) return false
  const parts = trimmed.slice(1).split(/\s+/)
  if (parts.length === 0 || !parts[0]) return false
  const args = parts.slice(1)
  return args.length >= meta.length
}

/**
 * 按 Esc 时应该做什么。
 *
 * 需求：补全菜单弹出时按 Esc，只关菜单、保留已输入的文本（如 /balance），
 * 光标回到命令名末尾，让用户可以直接回车执行；只有没菜单可关时才清空输入。
 */
export type EscapeAction = "dismiss-menu" | "clear-input" | "none"

export function escapeAction(options: {
  hasSelection: boolean
  hasCompletions: boolean
  input: string
}): EscapeAction {
  if (options.hasSelection) return "dismiss-menu"
  if (options.hasCompletions) return "dismiss-menu"
  if (options.input.length > 0) return "clear-input"
  return "none"
}

/**
 * Esc 关菜单时保留的输入内容。
 *
 * 补全会把 `回车` 插入成 `/<cmd> `（带尾随空格），Esc 时去掉尾随空格，
 * 让光标停在命令名末尾（即 `/balance` 的 e 后面），而不是空格后面。
 */
export function inputKeptOnEscape(input: string): string {
  return input.replace(/\s+$/, "")
}
export function shouldRunWithoutCompletion(
  value: string,
  meta: CommandArgMeta[] | undefined,
): boolean {
  if (!meta || meta.length === 0) return false
  // 只有全部参数都可选时才适用
  if (meta.some((arg) => arg.required)) return false
  const trimmed = value.trim()
  if (!trimmed.startsWith("/")) return false
  const parts = trimmed.slice(1).split(/\s+/)
  if (parts.length === 0 || !parts[0]) return false
  // 还没输入任何参数（包括只敲了空格的情况）
  return parts.slice(1).filter(Boolean).length === 0
}
