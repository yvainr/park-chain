declare module "react" {
  const React: any;
  export default React;
  export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void;
  export function useMemo<T>(factory: () => T, deps: unknown[]): T;
  export function useState<T>(initial: T): [T, (value: T | ((previous: T) => T)) => void];
}

declare module "react-dom/client" {
  export function createRoot(element: HTMLElement): {
    render(children: unknown): void;
  };
}

declare module "react/jsx-runtime" {
  export const Fragment: any;
  export const jsx: any;
  export const jsxs: any;
}

declare namespace JSX {
  interface IntrinsicElements {
    [elementName: string]: any;
  }
}

interface ImportMetaEnv {
  readonly VITE_PARKCHAIN_ROUTER_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
