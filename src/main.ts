import { Plugin } from "obsidian";
import { renderToString } from "@plantuml/core/plantuml.js";
import Viz from "./generated/viz.cjs";
import { createCore, type RenderCore } from "plantuml-core";

import { PLANTUML_THEMES } from "./generated/themes.js";

const CODE_BLOCK_LANGUAGES = ["plantuml", "puml"];

/** Globals the PlantUML engine reads before its first render. */
interface VizModule {
  instance(): Promise<unknown>;
  graphvizVersion: string;
}

interface EngineGlobals {
  PLANTUML_VIZ?: VizModule;
  PLANTUML_THEMES?: Record<string, string>;
  PLANTUML_STDLIB_LOADER?: (name: string, ok: () => void, fail: (message?: string) => void) => boolean;
}

export default class LocalPlantUMLPlugin extends Plugin {
  private core: RenderCore | null = null;

  async onload(): Promise<void> {
    this.installEngineGlobals();
    for (const language of CODE_BLOCK_LANGUAGES) {
      this.registerMarkdownCodeBlockProcessor(language, (source, el) => this.renderBlock(source, el));
    }
  }

  private installEngineGlobals(): void {
    const scope = window as unknown as EngineGlobals;
    scope.PLANTUML_VIZ = Viz as VizModule;
    scope.PLANTUML_THEMES = PLANTUML_THEMES;
    // No standard library ships with the plugin. Refusing every request keeps
    // the engine's URL-loading path unreachable (and therefore inert).
    scope.PLANTUML_STDLIB_LOADER = (name, _ok, fail) => {
      fail(`Standard library entry not bundled: ${name}`);
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
