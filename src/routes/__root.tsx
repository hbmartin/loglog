import { Outlet, createRootRoute, Link } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { ThemeProvider } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  return (
    <ThemeProvider defaultTheme="system">
      <Outlet />
      {import.meta.env.DEV ? <TanStackRouterDevtools position="bottom-right" /> : null}
    </ThemeProvider>
  );
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-4xl font-bold">Not found</h1>
      <p className="text-muted-foreground">That page — or that dog — isn't here.</p>
      <Button render={<Link to="/">Back to the pack</Link>} />
    </div>
  );
}
