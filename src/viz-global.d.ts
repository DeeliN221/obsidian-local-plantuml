declare module "@plantuml/core/viz-global.js" {
  export interface VizInstance {
    renderString(input: string, options?: Record<string, unknown>): Promise<string>;
    [key: string]: unknown;
  }

  export interface VizModule {
    instance(): Promise<VizInstance>;
    graphvizVersion: string;
  }

  const Viz: VizModule;
  export default Viz;
}
