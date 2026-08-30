// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "@/router";
import { __resetCache } from "@/lib/storage";
import { __resetMetaCache } from "@/lib/meta";

/**
 * A mount test, not a feature test: it exercises the router, the theme
 * provider, the Base UI components and the icon set together, which is the
 * combination a dependency bump breaks without failing typecheck or build.
 */

beforeEach(() => {
  // jsdom has no matchMedia, and ThemeProvider follows the OS through it.
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn<() => void>(),
      removeEventListener: vi.fn<() => void>(),
    }),
  );
  // scrollRestoration calls this; jsdom has no layout to scroll.
  vi.stubGlobal("scrollTo", vi.fn());
  window.localStorage.clear();
  __resetCache();
  __resetMetaCache();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  // cleanup() unmounts the tree but leaves what the theme effect wrote on
  // <html>, so without this a later case sees "dark" applied by an earlier
  // one and passes or fails on file order rather than on its own subject.
  document.documentElement.className = "";
});

describe("the app", () => {
  it("mounts and renders the dog list", async () => {
    render(<RouterProvider router={getRouter()} />);

    expect(await screen.findByRole("heading", { name: "loglog" })).toBeDefined();
    expect(screen.getByRole("button", { name: /enroll a subject/i })).toBeDefined();
  });

  it("renders the lab coat register when one is stored", async () => {
    window.localStorage.setItem("loglog:meta:v1", JSON.stringify({ register: "lab" }));
    render(<RouterProvider router={getRouter()} />);

    await screen.findByRole("heading", { name: "loglog" });
    // The whole point of the register is that it swaps prose without touching
    // behaviour, so the control it renames is still the same control.
    expect(screen.getByRole("button", { name: /register subject/i })).toBeDefined();
  });

  it("resolves the stored theme onto the document", async () => {
    window.localStorage.setItem("loglog:theme", "dark");
    render(<RouterProvider router={getRouter()} />);

    await screen.findByRole("heading", { name: "loglog" });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
