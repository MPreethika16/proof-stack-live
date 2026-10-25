// Ambient type declaration for optional playwright dependency when not installed locally
declare module "playwright" {
  export interface Request {
    url(): string;
  }
  export interface Route {
    request(): Request;
    continue(): Promise<void>;
    abort(errorCode?: string): Promise<void>;
  }
  export interface Locator {
    innerText(): Promise<string>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }
  export interface Mouse {
    wheel(deltaX: number, deltaY: number): Promise<void>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }
  export interface Page {
    setDefaultTimeout(timeout: number): void;
    goto(url: string, options?: unknown): Promise<unknown>;
    waitForLoadState(state: string, options?: unknown): Promise<void>;
    evaluate(pageFunction: unknown): Promise<unknown>;
    screenshot(options?: unknown): Promise<Buffer>;
    close(): Promise<void>;
    url(): string;
    title(): Promise<string>;
    locator(selector: string): Locator;
    mouse: Mouse;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }
  export interface BrowserContext {
    route(url: string | RegExp, handler: (route: Route) => unknown): Promise<void>;
    newPage(): Promise<Page>;
    close(): Promise<void>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }
  export interface Browser {
    newContext(options?: unknown): Promise<BrowserContext>;
    close(): Promise<void>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }
  export interface BrowserType {
    launch(options?: unknown): Promise<Browser>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }
  export const chromium: BrowserType;
}
