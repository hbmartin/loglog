import { useEffect, useRef, useState, type ReactNode } from "react";
import { toggleRegister } from "@/lib/meta";
import { cn } from "@/lib/utils";

const HOLD_MS = 600;

/**
 * The wordmark, and the hidden way into lab coat mode.
 *
 * Deliberately not a button. An easter egg that announces itself in the
 * accessibility tree as an interactive control - one with no sensible keyboard
 * behaviour, since the whole gesture is the hold - is worse than no easter egg
 * at all. The same switch is a plain, labelled menu item in the display menu,
 * so nobody has to find this to reach it.
 */
export function AppTitle({
  children,
  className,
}: Readonly<{ children: ReactNode; className?: string }>) {
  const timer = useRef<number | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const cancel = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  // A hold that outlives the component - navigating away mid-press - would
  // otherwise fire into an unmounted tree. Inlined rather than reusing
  // `cancel` so the effect closes over nothing but the ref.
  useEffect(
    () => () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
    },
    [],
  );

  const start = () => {
    cancel();
    timer.current = window.setTimeout(() => {
      timer.current = null;
      const next = toggleRegister();
      setAnnouncement(next === "lab" ? "Lab coat mode on." : "Lab coat mode off.");
      try {
        navigator.vibrate?.([8, 40, 8]);
      } catch {
        // Decorative; the copy has already changed either way.
      }
    }, HOLD_MS);
  };

  useEffect(() => {
    if (announcement === "") {
      return;
    }
    const id = window.setTimeout(() => setAnnouncement(""), 2400);
    return () => window.clearTimeout(id);
  }, [announcement]);

  return (
    <>
      <h1
        className={cn("font-display text-3xl font-semibold tracking-tight select-none", className)}
      >
        {/* The gesture lives on the text, not on the heading: an <h1> carrying
            pointer handlers reads as an interactive control to anything walking
            the accessibility tree, and this one deliberately is not. */}
        <span
          onPointerDown={start}
          onPointerUp={cancel}
          onPointerLeave={cancel}
          onPointerCancel={cancel}
          // A long press on touch otherwise pops the selection callout over it.
          onContextMenu={(event) => event.preventDefault()}
        >
          {children}
        </span>
      </h1>
      <output aria-live="polite" className="sr-only">
        {announcement}
      </output>
    </>
  );
}
