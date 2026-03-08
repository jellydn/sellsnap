import { type RenderOptions, type RenderResult, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

function AllProviders({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

function renderWithRouter(
  ui: ReactElement,
  options?: RenderOptions & { route?: string; path?: string },
): RenderResult {
  const { route = "/", path, ...renderOptions } = options || {};

  // Auto-detect route pattern if not provided
  const routePath = path || (route.includes("/creators/") ? "/creators/:slug" : "/*");

  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path={routePath} element={ui} />
      </Routes>
    </MemoryRouter>,
    renderOptions,
  );
}

export { renderWithRouter, AllProviders };
