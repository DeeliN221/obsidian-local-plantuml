import { Plugin } from "obsidian";
import { renderToString } from "@plantuml/core/plantuml.js";
import { createCore, type RenderCore } from "plantuml-core";

import { STDLIB_SOURCES, THEMES_SOURCE, VIZ_SOURCE } from "./generated/assets.js";

const CODE_BLOCK_LANGUAGES = ["plantuml", "puml"];

/** Resolved once per app; the engine exposes these as globals. */
const evaluated = new Set<string>();

/** The engine's global stdlib hook, installed once per app. */
interface StdlibGlobal {
  PLANTUML_STDLIB_LOADER?: (name: string, ok: () => void, fail: (message?: string) => void) => boolean;
}

function evalOnce(key: string, source: string): void {
  if (evaluated.has(key)) return;
  // Indirect eval runs in global scope, so the UMD wrapper attaches Viz /
  // PLANTUML_THEMES / PLANTUML_STDLIB to globalThis.
  (0, eval)(source);
  evaluated.add(key);
}

export default class LocalPlantUMLPlugin extends Plugin {
  private core: RenderCore | null = null;

  async onload(): Promise<void> {
    this.evalBootstrapAssets();
    this.installStdlibLoader();
    for (const language of CODE_BLOCK_LANGUAGES) {
      this.registerMarkdownCodeBlockProcessor(language, (source, el) => this.renderBlock(source, el));
    }
  }

  private evalBootstrapAssets(): void {
    evalOnce("viz", VIZ_SOURCE);
    evalOnce("themes", THEMES_SOURCE);
  }

  private installStdlibLoader(): void {
    const global = globalThis as unknown as StdlibGlobal;
    global.PLANTUML_STDLIB_LOADER = (name, ok, fail) => {
      const source = STDLIB_SOURCES[name];
      if (source === undefined) {
        fail(`Unknown PlantUML standard-library entry: ${name}`);
        return true;
      }
      try {
        evalOnce(`stdlib:${name}`, source);
        ok();
      } catch (error) {
        fail(error instanceof Error ? error.message : String(error));
      }
      return true;
    };
  }

  private getCore(): RenderCore {
    if (!this.core) {
      this.core = createCore({
        wrapMissingDelimiters: true,
        engine: {
          render: (source, { dark }) => this.renderSvg(source, dark),
        },
      });
    }
    return this.core;
  }

  private renderSvg(source: string, dark: boolean): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      renderToString(
        source.split("\n"),
        (svg) => resolve(svg),
        (message) => reject(new Error(message)),
        { dark },
      );
    });
  }

  private async renderBlock(source: string, el: HTMLElement): Promise<void> {
    el.empty();
    el.addClass("local-plantuml");
    try {
      const svg = await this.getCore().render(source, {
        dark: document.body.classList.contains("theme-dark"),
      });
      const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
      el.appendChild(el.ownerDocument.importNode(doc.documentElement, true));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      el.createEl("pre", { cls: "local-plantuml-error", text: `PlantUML 渲染失败：${message}` });
    }
  }
}
