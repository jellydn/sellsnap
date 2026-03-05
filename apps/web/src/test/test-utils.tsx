import { type RenderOptions, type RenderResult, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";

function AllProviders({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

function renderWithRouter(
  ui: ReactElement,
  options?: RenderOptions & { route?: string },
): RenderResult {
  const { route = "/", ...renderOptions } = options || {};
  return render(ui, {
    wrapper: ({ children }) => <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>,
    ...renderOptions,
  });
}

export { renderWithRouter, AllProviders };
