import { createRouter } from "@tanstack/react-router";
import { ErrorScreen } from "@/components/error-screen";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultErrorComponent: ({ error }) => <ErrorScreen error={error} />,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
