/**
 * Host-agnostic PlantUML render core.
 *
 * Both hosts (the Obsidian plugin and the DSH client plugin) need the same
 * four things around the engine, and nothing else:
 *
 *   1. normalize the source (line endings, optional missing `@start`/`@end`),
 *   2. run the engine one diagram at a time (it keeps global state),
 *   3. cache the SVG per source + theme,
 *   4. strip executable constructs from the markup.
 *
 * Everything host-specific — how the engine is loaded, where the standard
 * library comes from, how a code block is discovered — stays in the host
 * adapter. The engine adapter only has to expose:
 *
 *     render(sourceText, { dark }) => Promise<string>   // SVG markup
 *
 * @module plantuml-core
 */

/** A pathological diagram should fail visibly instead of hanging the queue. */
export const DEFAULT_RENDER_TIMEOUT_MS = 20_000
/** Rendered SVG cache size, so a scrolled-away diagram remounts instantly. */
export const DEFAULT_CACHE_LIMIT = 150

/** Fence info strings that name PlantUML outright. */
export const PLANTUML_LANGUAGES = new Set([
  'plantuml',
  'puml',
  'uml',
  'iuml',
  'pu',
  'wsd',
  'plantuml-svg',
  'plantuml-png',
  'plantuml-txt',
])

/** `@startuml` / `@enduml` and their many siblings. */
const START_RE = /^[ \t]*@start[\w-]+/m
const END_RE = /^[ \t]*@end[\w-]+/m

/**
 * @param {string} language Code fence info string, without the backticks.
 * @returns {boolean} Whether the fence is tagged as PlantUML.
 */
export function isPlantUmlLanguage(language) {
  return PLANTUML_LANGUAGES.has(String(language ?? '').trim().toLowerCase())
}

/**
 * Whether a fence carries a matched `@start…` / `@end…` pair.
 *
 * @param {string} source Fence text.
 * @returns {boolean} True when both delimiters are present.
 */
export function hasDelimiters(source) {
  const text = String(source ?? '')
  return START_RE.test(text) && END_RE.test(text)
}

/**
 * @param {string} source
 * @returns {boolean} Whether the source looks like PlantUML without being tagged.
 */
export function looksLikePlantUml(source) {
  return hasDelimiters(source)
}

/**
 * Normalize line endings and trim the fence.
 *
 * @param {string} source Raw fence text.
 * @param {{ wrapMissingDelimiters?: boolean }} [options]
 *   `wrapMissingDelimiters` matches the Obsidian plugin's leniency: notes
 *   routinely omit the delimiters. The DSH plugin keeps them optional only
 *   because the engine accepts some diagram types either way.
 * @returns {string} Normalized source.
 */
export function normalizeSource(source, { wrapMissingDelimiters = false } = {}) {
  const text = String(source ?? '')
    .replace(/\r\n?/g, '\n')
    .trim()
  if (text === '') return ''
  if (!wrapMissingDelimiters || START_RE.test(text)) return text
  return `@startuml\n${text}\n@enduml`
}

/**
 * Strip the few SVG constructs that can execute or reach out.
 *
 * The engine is local and escapes diagram text, so this is defence in depth
 * rather than the only barrier; a malformed tree simply passes through
 * untouched instead of blanking the diagram.
 *
 * @param {string} markup Engine-produced SVG markup.
 * @param {{
 *   DOMParser?: typeof globalThis.DOMParser,
 *   XMLSerializer?: typeof globalThis.XMLSerializer,
 * }} [dom] Injectable DOM constructors (the defaults are browser globals).
 * @returns {string} Sanitized markup, or the input when no DOM is available.
 */
export function sanitizeSvg(markup, dom = {}) {
  const Parser = dom.DOMParser ?? globalThis.DOMParser
  const Serializer = dom.XMLSerializer ?? globalThis.XMLSerializer
  if (typeof Parser !== 'function' || typeof Serializer !== 'function') return markup
  try {
    const doc = new Parser().parseFromString(markup, 'image/svg+xml')
    if (doc.querySelector('parsererror') !== null) return markup
    for (const node of doc.querySelectorAll('script, foreignObject')) node.remove()
    for (const node of doc.querySelectorAll('*')) {
      for (const attribute of [...node.attributes]) {
        const name = attribute.name.toLowerCase()
        if (name.startsWith('on')) node.removeAttribute(attribute.name)
        else if (
          (name === 'href' || name === 'xlink:href') &&
          /^[\s\u0000-\u001f]*javascript:/i.test(attribute.value)
        ) {
          node.removeAttribute(attribute.name)
        }
      }
    }
    return new Serializer().serializeToString(doc.documentElement)
  } catch {
    return markup
  }
}

/**
 * @typedef {object} RenderCoreOptions
 * @property {{ render(source: string, options: { dark: boolean }): Promise<string> }} engine
 *   Host engine adapter. Must resolve to SVG markup.
 * @property {boolean} [wrapMissingDelimiters=false]
 * @property {boolean} [sanitize=true]
 * @property {number} [timeoutMs]
 * @property {number} [cacheLimit]
 * @property {{ DOMParser?: typeof globalThis.DOMParser, XMLSerializer?: typeof globalThis.XMLSerializer }} [dom]
 *   Injected DOM used by {@link sanitizeSvg}; tests pass a stub or `sanitize:false`.
 */

/**
 * Create one renderer for one host.
 *
 * @param {RenderCoreOptions} options
 * @returns {{
 *   render(source: string, options?: { dark?: boolean }): Promise<string>,
 *   clearCache(): void,
 *   cacheSize(): number,
 * }} Renderer bound to the supplied engine.
 */
export function createCore({
  engine,
  wrapMissingDelimiters = false,
  sanitize = true,
  timeoutMs = DEFAULT_RENDER_TIMEOUT_MS,
  cacheLimit = DEFAULT_CACHE_LIMIT,
  dom = {},
} = {}) {
  if (typeof engine?.render !== 'function') {
    throw new TypeError('createCore: engine.render(source, { dark }) is required')
  }

  /** Serializes engine calls, which mutate shared global engine state. */
  let queue = Promise.resolve()
  /** Rendered SVG keyed by `<theme>\0<source>`. */
  const cache = new Map()

  /**
   * Run one engine task after every previously queued task settles.
   *
   * @template T
   * @param {() => Promise<T>} task
   * @returns {Promise<T>}
   */
  function enqueue(task) {
    const run = queue.then(task)
    queue = run.then(
      () => {},
      () => {},
    )
    return run
  }

  /**
   * @param {boolean} dark
   * @param {string} source
   * @returns {string}
   */
  const keyOf = (dark, source) => `${dark ? 'd' : 'l'}\u0000${source}`

  /** @param {string} key */
  function readCache(key) {
    const hit = cache.get(key)
    if (hit === undefined) return undefined
    // Refresh recency so the eviction below drops genuinely cold entries.
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }

  /**
   * @param {string} key
   * @param {string} svg
   */
  function writeCache(key, svg) {
    cache.delete(key)
    cache.set(key, svg)
    while (cache.size > cacheLimit) cache.delete(cache.keys().next().value)
  }

  /**
   * Resolve after `task`, or reject when `timeoutMs` elapses first.
   *
   * @template T
   * @param {Promise<T>} task
   * @returns {Promise<T>}
   */
  function withTimeout(task) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return task
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`PlantUML render timed out after ${timeoutMs}ms`)), timeoutMs)
      task.then(
        (value) => {
          clearTimeout(timer)
          resolve(value)
        },
        (error) => {
          clearTimeout(timer)
          reject(error)
        },
      )
    })
  }

  return {
    /**
     * Render one diagram, reusing a cached SVG when the same source and theme
     * were rendered before.
     *
     * @param {string} source PlantUML source text.
     * @param {{ dark?: boolean }} [options]
     * @returns {Promise<string>} Sanitized SVG markup.
     */
    async render(source, { dark = false } = {}) {
      const normalized = normalizeSource(source, { wrapMissingDelimiters })
      if (normalized === '') throw new Error('Empty PlantUML source')
      const key = keyOf(Boolean(dark), normalized)
      const cached = readCache(key)
      if (cached !== undefined) return cached

      const svg = await enqueue(async () => {
        const result = await withTimeout(Promise.resolve(engine.render(normalized, { dark: Boolean(dark) })))
        if (typeof result !== 'string' || result.trim() === '') {
          throw new Error('PlantUML engine returned no SVG')
        }
        return sanitize ? sanitizeSvg(result, dom) : result
      })
      writeCache(key, svg)
      return svg
    },

    clearCache() {
      cache.clear()
    },

    cacheSize() {
      return cache.size
    },
  }
}
