export interface RenderOptions { dark?: boolean }
export interface EngineAdapter { render(source: string, options: { dark: boolean }): Promise<string> }
export interface RenderCore {
  render(source: string, options?: RenderOptions): Promise<string>
  clearCache(): void
  cacheSize(): number
}
export interface CreateCoreOptions {
  engine: EngineAdapter
  wrapMissingDelimiters?: boolean
  sanitize?: boolean
  timeoutMs?: number
  cacheLimit?: number
}
export declare function createCore(options: CreateCoreOptions): RenderCore
export declare function normalizeSource(source: string, options?: { wrapMissingDelimiters?: boolean }): string
export declare function isPlantUmlLanguage(language: string): boolean
export declare function hasDelimiters(source: string): boolean
export declare function looksLikePlantUml(source: string): boolean
export declare function sanitizeSvg(markup: string): string
