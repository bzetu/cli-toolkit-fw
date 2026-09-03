/** @jsxImportSource @opentui/solid */

import { InputRenderable, ScrollBoxRenderable, type KeyEvent, type ScrollAcceleration } from "@opentui/core"
import { For, Show, createEffect, createMemo, createSignal, onMount } from "solid-js"
import { useKeyboard, useRenderer } from "@opentui/solid"
import type { Command, CommandResult, OutputTone, Route, SelectionRequest, ToolModule, TranscriptEntry } from "../core/types"
import { CommandRegistry, ToolRegistry } from "../core/registry"
import { createCoreCommands } from "../core/commands"
import { logError } from "../platform/logger"

const colors = {
  background: "#0b0c0f",
  surface: "#121419",
  elevated: "#191c23",
  selected: "#252b38",
  border: "#2a2e38",
  text: "#d9dbe1",
  muted: "#737986",
  subtle: "#4d5360",
  primary: "#7aa2f7",
  success: "#9ece6a",
  warning: "#e0af68",
  error: "#f7768e",
}

class FixedSpeedScroll implements ScrollAcceleration {
  tick() {
    return 3
  }
  reset() {}
}

function toneColor(tone?: OutputTone) {
  if (tone === "success") return colors.success
  if (tone === "error") return colors.error
  if (tone === "muted") return colors.muted
  return colors.text
}

export function App(props: { appName: string; tools: ToolModule[]; cwd: string }) {
  const renderer = useRenderer()
  const tools = new ToolRegistry()
  props.tools.forEach((tool) => tools.register(tool))

  let registry: CommandRegistry
  const core = createCoreCommands(props.tools, (scope) => registry.list(scope))
  registry = new CommandRegistry(core, tools)

  const [route, setRoute] = createSignal<Route>({ kind: "home" })
  const histories = new Map<string, TranscriptEntry[]>()
  const [history, setHistory] = createSignal<TranscriptEntry[]>([
    {
      id: 1,
      kind: "output",
      text: `欢迎使用 ${props.appName}\n\n这是一个不依赖 LLM 的本地指令工具集合框架。\n输入 /tools 选择工具，输入 / 查看当前命令。`,
      tone: "muted",
    },
  ])
  histories.set("home", history())
  const [inputValue, setInputValue] = createSignal("")
  const [busy, setBusy] = createSignal(false)
  const [selection, setSelection] = createSignal<SelectionRequest>()
  const [selected, setSelected] = createSignal(0)
  const [commandSelected, setCommandSelected] = createSignal(0)
  let nextEntryID = 2
  let input!: InputRenderable
  let transcript!: ScrollBoxRenderable
  let selectionList: ScrollBoxRenderable | undefined
  let commandList: ScrollBoxRenderable | undefined

  const scope = () => {
    const active = route()
    return active.kind === "tool" ? active.toolID : "home"
  }
  const currentTool = () => {
    const active = route()
    return active.kind === "tool" ? tools.get(active.toolID) : undefined
  }
  const commands = () => registry.list(scope())
  const commandMatches = createMemo(() => {
    if (selection()) return []
    const value = inputValue().trim().toLowerCase()
    if (!value.startsWith("/")) return []
    const query = value.slice(1)
    return commands().filter((command) =>
      [command.name, ...(command.aliases ?? [])].some((name) => name.toLowerCase().startsWith(query)),
    )
  })

  const append = (kind: TranscriptEntry["kind"], text: string, tone?: OutputTone) => {
    setHistory((entries) => [...entries, { id: nextEntryID++, kind, text, tone }])
    setTimeout(() => transcript?.scrollTo(transcript.scrollHeight), 0)
  }

  const saveHistory = () => histories.set(scope(), history())

  const navigate = async (next: Route) => {
    saveHistory()
    setSelection(undefined)
    setSelected(0)
    setRoute(next)
    const nextScope = next.kind === "home" ? "home" : next.toolID
    const existing = histories.get(nextScope)
    if (existing) {
      setHistory(existing)
    } else {
      const initial: TranscriptEntry[] = []
      histories.set(nextScope, initial)
      setHistory(initial)
      if (next.kind === "tool") {
        const tool = tools.get(next.toolID)
        if (tool?.onEnter) await applyResult(await tool.onEnter({ cwd: props.cwd, toolID: tool.id }))
      }
    }
    setTimeout(() => transcript?.scrollTo(transcript.scrollHeight), 0)
  }

  const applyResult = async (result: CommandResult) => {
    if (result.clear) {
      setHistory([])
      histories.set(scope(), [])
    }
    if (result.output) append("output", result.output, result.tone)
    if (result.selection) {
      setSelection(result.selection)
      const current = result.selection.options.findIndex((option) => option.current)
      setSelected(current >= 0 ? current : 0)
    }
    if (result.navigate) await navigate(result.navigate)
    if (result.exit) renderer.destroy()
  }

  const execute = async (raw: string) => {
    const value = raw.trim()
    if (!value || busy()) return
    append("input", value)
    setInputValue("")
    input.value = ""
    setSelection(undefined)
    setBusy(true)
    try {
      if (!value.startsWith("/")) throw new Error("请输入 / 查看当前可用命令")
      const [name, ...args] = value.slice(1).split(/\s+/)
      const command = registry.find(scope(), name ?? "")
      if (!command) throw new Error(`未知指令：/${name}`)
      await applyResult(await command.run({ cwd: props.cwd, toolID: currentTool()?.id }, args))
    } catch (error) {
      logError(`command ${value}`, error)
      append("output", `错误：${error instanceof Error ? error.message : String(error)}`, "error")
    } finally {
      setBusy(false)
      if (!renderer.isDestroyed) input.focus()
    }
  }

  const chooseSelection = async () => {
    const current = selection()
    const option = current?.options[selected()]
    if (!current || !option || busy()) return
    setSelection(undefined)
    setBusy(true)
    append("input", option.title)
    try {
      await applyResult(await current.onSelect(option))
    } catch (error) {
      logError(`selection ${option.id}`, error)
      append("output", `错误：${error instanceof Error ? error.message : String(error)}`, "error")
    } finally {
      setBusy(false)
      if (!renderer.isDestroyed) input.focus()
    }
  }

  const moveSelection = (delta: number) => {
    const current = selection()
    if (!current?.options.length) return
    setSelected((index) => (index + delta + current.options.length) % current.options.length)
  }

  createEffect(() => {
    const current = selection()
    const index = selected()
    if (!current) return
    setTimeout(() => selectionList?.scrollChildIntoView(`selection-option-${index}`), 0)
  })

  createEffect(() => {
    const matches = commandMatches()
    const index = commandSelected()
    if (!matches.length) return
    setTimeout(() => commandList?.scrollChildIntoView(`command-option-${index}`), 0)
  })

  useKeyboard((key: KeyEvent) => {
    if (key.ctrl && key.name === "c") {
      key.preventDefault()
      renderer.destroy()
      return
    }
    const current = selection()
    if ((key.name === "up" || key.name === "down") && current?.options.length) {
      key.preventDefault()
      const delta = key.name === "up" ? -1 : 1
      moveSelection(delta)
      return
    }
    const matches = commandMatches()
    if ((key.name === "up" || key.name === "down") && matches.length) {
      key.preventDefault()
      const delta = key.name === "up" ? -1 : 1
      setCommandSelected((index) => (index + delta + matches.length) % matches.length)
      return
    }
    if (key.name === "tab" && matches.length) {
      key.preventDefault()
      const command = matches[commandSelected()] ?? matches[0]
      if (command) {
        const value = `/${command.name}`
        setInputValue(value)
        input.value = value
        input.cursorOffset = value.length
      }
      return
    }
    if (key.name === "return" && current && inputValue().trim() === "") {
      key.preventDefault()
      void chooseSelection()
      return
    }
    if (key.name === "escape") {
      if (current) {
        key.preventDefault()
        setSelection(undefined)
      } else if (inputValue()) {
        key.preventDefault()
        setInputValue("")
        input.value = ""
      }
    }
  })

  onMount(() => input.focus())

  return (
    <box flexDirection="column" width="100%" height="100%" backgroundColor={colors.background}>
      <box height={3} flexShrink={0} paddingLeft={2} paddingRight={2} flexDirection="column">
        <box height={1} />
        <box height={1} flexDirection="row">
          <text fg={colors.primary}><b>◆ {props.appName}</b></text>
          <Show when={currentTool()}>
            {(tool) => <text fg={colors.muted}>  /  {tool().title}</text>}
          </Show>
        </box>
      </box>

      <scrollbox
        ref={(value: ScrollBoxRenderable) => (transcript = value)}
        flexGrow={1}
        paddingLeft={3}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        stickyScroll={true}
        stickyStart="bottom"
        scrollAcceleration={new FixedSpeedScroll()}
        verticalScrollbarOptions={{
          trackOptions: { backgroundColor: colors.background, foregroundColor: colors.subtle },
        }}
      >
        <For each={history()}>
          {(entry) => (
            <box flexDirection="column" marginBottom={1}>
              <Show when={entry.kind === "input"} fallback={<text fg={toneColor(entry.tone)}>{entry.text}</text>}>
                <box
                  border={["left"]}
                  borderColor={colors.primary}
                  backgroundColor={colors.surface}
                  paddingLeft={1}
                  paddingRight={1}
                >
                  <text fg={colors.text}><b>{entry.text}</b></text>
                </box>
              </Show>
            </box>
          )}
        </For>
        <Show when={busy()}>
          <text fg={colors.warning}>● 正在执行…</text>
        </Show>
      </scrollbox>

      <Show when={selection()}>
        {(request) => (
          <box
            flexDirection="column"
            height={Math.min(
              request().options.reduce((rows, option) => rows + (option.description ? 2 : 1), 0) + 3,
              13,
            )}
            flexShrink={0}
            marginLeft={3}
            marginRight={3}
            border={["left"]}
            borderColor={colors.primary}
            backgroundColor={colors.elevated}
            paddingTop={1}
            paddingBottom={1}
          >
            <box height={1} paddingLeft={2} paddingRight={2} flexDirection="row">
              <text fg={colors.text}><b>{request().title}</b></text>
              <text flexGrow={1} />
              <text fg={colors.subtle}>↑↓ 选择  Enter 确认  Esc 关闭</text>
            </box>
            <scrollbox
              ref={(value: ScrollBoxRenderable) => (selectionList = value)}
              flexGrow={1}
              scrollbarOptions={{ visible: false }}
              scrollAcceleration={new FixedSpeedScroll()}
            >
              <For each={request().options}>
                {(option, index) => {
                  const active = () => index() === selected()
                  return (
                    <box
                      id={`selection-option-${index()}`}
                      flexDirection="column"
                      paddingLeft={2}
                      paddingRight={2}
                      backgroundColor={active() ? colors.selected : colors.background}
                      onMouseOver={() => setSelected(index())}
                      onMouseUp={() => {
                        setSelected(index())
                        void chooseSelection()
                      }}
                    >
                      <text fg={active() ? colors.primary : option.current ? colors.success : colors.text}>
                        {active() ? "● " : "  "}{option.title}{option.current ? "  current" : ""}
                      </text>
                      <Show when={option.description}>
                        <text fg={colors.muted}>    {option.description}</text>
                      </Show>
                    </box>
                  )
                }}
              </For>
            </scrollbox>
          </box>
        )}
      </Show>

      <Show when={commandMatches().length > 0}>
        <scrollbox
          ref={(value: ScrollBoxRenderable) => (commandList = value)}
          height={Math.min(commandMatches().length, 6)}
          flexShrink={0}
          marginLeft={3}
          marginRight={3}
          border={["left"]}
          borderColor={colors.primary}
          backgroundColor={colors.elevated}
          scrollbarOptions={{ visible: false }}
          scrollAcceleration={new FixedSpeedScroll()}
        >
          <For each={commandMatches()}>
            {(command, index) => {
              const active = () => index() === commandSelected()
              return (
                <box
                  id={`command-option-${index()}`}
                  paddingLeft={2}
                  paddingRight={2}
                  flexDirection="row"
                  backgroundColor={active() ? colors.selected : colors.elevated}
                  onMouseOver={() => setCommandSelected(index())}
                  onMouseUp={() => void execute(`/${command.name}`)}
                >
                  <text width={16} fg={active() ? colors.primary : colors.text}>
                    {active() ? "●" : " "} /{command.name}
                  </text>
                  <text fg={active() ? colors.text : colors.muted}>{command.description}</text>
                </box>
              )
            }}
          </For>
        </scrollbox>
      </Show>

      <box
        flexDirection="column"
        height={3}
        flexShrink={0}
        marginLeft={3}
        marginRight={3}
        border={["left"]}
        borderColor={busy() ? colors.warning : colors.primary}
        backgroundColor={colors.surface}
        paddingLeft={1}
        paddingRight={1}
      >
        <box height={1} />
        <box height={1} flexDirection="row">
          <text width={2} fg={busy() ? colors.warning : colors.primary}>›</text>
          <input
            ref={(value: InputRenderable) => (input = value)}
            flexGrow={1}
            value={inputValue()}
            placeholder={busy() ? "正在执行…" : "输入指令，/ 查看命令"}
            textColor={colors.text}
            focused={!busy()}
            onInput={(value: string) => {
              setInputValue(value)
              setCommandSelected(0)
            }}
            onSubmit={(submitted: unknown) => {
              const value = typeof submitted === "string" ? submitted : input.value
              const matches = commandMatches()
              const chosen = matches[commandSelected()]
              void execute(chosen ? `/${chosen.name}` : value)
            }}
          />
        </box>
      </box>
      <box height={2} flexShrink={0} paddingLeft={4} paddingRight={3} paddingTop={1} flexDirection="row">
        <text fg={colors.subtle}>{currentTool() ? "tool" : "home"}</text>
        <text flexGrow={1} />
        <text fg={colors.subtle}>/ commands   ↑↓ select   tab complete   enter run</text>
      </box>
    </box>
  )
}
