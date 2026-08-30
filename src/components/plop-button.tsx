import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The save button, with weight.
 *
 * The button takes a short squash and a ring leaves from underneath it, which
 * is the closest an interface gets to the sound the app is named after. All of
 * it is decorative: the confirmation line and the new history row are what
 * actually tell the user the log landed, and both survive
 * prefers-reduced-motion turning every animation here off.
 */
export function PlopButton({
  onPlop,
  children,
  className,
  disabled = false,
}: Readonly<{
  onPlop: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}>) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  // Remounting the ripple is what restarts it; it is a bare decorative span,
  // so unlike the button it can be keyed without costing anyone their focus.
  const [ripple, setRipple] = useState(0);

  const plop = () => {
    const node = buttonRef.current;
    if (node !== null) {
      // Standard restart: drop the class, force a reflow, add it back. A
      // second tap during the first animation retriggers instead of doing
      // nothing.
      node.classList.remove("animate-plop");
      void node.offsetWidth;
      node.classList.add("animate-plop");
    }
    // Best effort. Unimplemented on iOS Safari and refused without a gesture
    // elsewhere, so it can never be something the save depends on.
    try {
      navigator.vibrate?.(12);
    } catch {
      // A browser that throws here still logged the entry.
    }
    setRipple((count) => count + 1);
    onPlop();
  };

  return (
    <span className={cn("relative isolate block", className)}>
      {ripple === 0 ? null : (
        <span
          key={ripple}
          aria-hidden="true"
          className="animate-ripple bg-primary pointer-events-none absolute inset-0 -z-10 rounded-md"
        />
      )}
      <Button ref={buttonRef} size="lg" className="w-full" disabled={disabled} onClick={plop}>
        {children}
      </Button>
    </span>
  );
}
