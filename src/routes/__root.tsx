import { Outlet, createRootRoute, Link } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { ThemeProvider } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { useLexicon } from "@/lib/meta";

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
  const copy = useLexicon();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="font-display text-4xl font-semibold">{copy.notFoundTitle}</h1>
      <p className="text-muted-foreground">{copy.notFoundBody}</p>
      <Button render={<Link to="/">{copy.backHome}</Link>} />
    </div>
  );
}
