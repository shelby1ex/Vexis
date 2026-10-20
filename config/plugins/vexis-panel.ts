import type { Plugin } from "@opencode-ai/plugin"

/**
 * Vexis artifact-panel bridge.
 *
 * The Vexis UI (server.py) exposes `POST /vexis/artifact`, which pushes a file
 * or a URL into the user's right-hand artifact panel. This plugin registers a
 * `vexis_show` tool so the model can put something in that panel on purpose,
 * for example the HTML page it just built.
 *
 * The `@opencode-ai/plugin` helper is imported dynamically and is optional: if
 * the package is unavailable (a machine that never ran `bun install`), the
 * plugin still loads cleanly, it just offers no tool. Files the model writes
 * are pushed automatically by the UI itself, so nothing breaks.
 */
const UI_FALLBACK_PORT = "8001"
const PUSH_TIMEOUT_MS = 5000

type Artifact = { path?: string; url?: string; title?: string; kind?: string }

type PushResult = { ok?: boolean; artifact?: Artifact; error?: string }

async function pushArtifact(payload: Artifact): Promise<PushResult> {
  const port = process.env.VEXIS_UI_PORT || UI_FALLBACK_PORT
  const secret = process.env.VEXIS_UI_SECRET || ""
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), PUSH_TIMEOUT_MS)
  try {
    const res = await fetch(`http://127.0.0.1:${port}/vexis/artifact`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Vexis-Secret": secret },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    })
    return (await res.json()) as PushResult
  } catch (err) {
    return { ok: false, error: String(err) }
  } finally {
    clearTimeout(timer)
  }
}

export const VexisPanelPlugin: Plugin = async () => {
  let helper: { tool?: (def: unknown) => unknown; schema?: unknown } | null = null
  try {
    // Value import is optional - keep the plugin loadable without the package.
    helper = (await import("@opencode-ai/plugin")) as typeof helper
  } catch {
    helper = null
  }
  if (!helper || typeof helper.tool !== "function") return {}

  const tool = helper.tool as (def: unknown) => unknown
  const z = (helper as { schema?: unknown }).schema ?? (helper.tool as { schema?: unknown }).schema

  return {
    tool: {
      vexis_show: tool({
        description:
          "Show an artifact in the user's right-hand Vexis panel: a file you " +
          "created (HTML page, report, image, PDF, markdown, code) or an http(s) " +
          "website. Use it after building something so the user sees it " +
          "immediately, and to preview a site you are working on. Provide a " +
          "workspace-relative or absolute `path`, or a `url`.",
        args: {
          path: z.string().optional().describe("File to show (workspace-relative or absolute)"),
          url: z.string().optional().describe("http(s) URL to preview in the panel"),
          title: z.string().optional().describe("Short title for the panel entry"),
        },
        async execute(args: Artifact) {
          const got = await pushArtifact({
            path: args && args.path,
            url: args && args.url,
            title: args && args.title,
          })
          if (got && got.ok) {
            const a = got.artifact || {}
            return "Shown in the Vexis panel: " + (a.title || a.path || a.url || "artifact")
          }
          return "Panel push failed: " + ((got && got.error) || "unavailable")
        },
      }),
    },
  }
}
