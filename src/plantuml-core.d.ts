declare module "plantuml-core" {
  export interface RenderOptions {
    dark?: boolean;
  }

  export interface RenderCore {
    render(source: string, options?: RenderOptions): Promise<string>;
    clearCache(): void;
    cacheSize(): number;
  }

  export interface EngineAdapter {
    render(source: string, options: { dark: boolean }): Promise<string>;
  }

  export interface CreateCoreOptions {
    engine: EngineAdapter;
    wrapMissingDelimiters?: boolean;
    sanitize?: boolean;
    timeoutMs?: number;
    cacheLimit?: number;
  }

  export function createCore(options: CreateCoreOptions): RenderCore;
  export function normalizeSource(source: string, options?: { wrapMissingDelimiters?: boolean }): string;
  export function isPlantUmlLanguage(language: string): boolean;
  export function hasDelimiters(source: string): boolean;
  export function looksLikePlantUml(source: string): boolean;
  export function sanitizeSvg(markup: string): string;
}
