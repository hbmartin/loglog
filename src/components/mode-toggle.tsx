import { FlaskConical, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/theme-provider";
import { setRegister, useMeta } from "@/lib/meta";

/**
 * Display settings: the theme, plus the accessible way into lab coat mode.
 *
 * The register also has a hidden gesture on the wordmark, which is the fun
 * one. This is the one that can be found, read out and operated from a
 * keyboard.
 */
export function ModeToggle() {
  const { setTheme } = useTheme();
  const { register } = useMeta();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="icon">
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Display settings</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setRegister(register === "lab" ? "field" : "lab")}>
          <FlaskConical />
          {register === "lab" ? "Lab coat mode: on" : "Lab coat mode: off"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
