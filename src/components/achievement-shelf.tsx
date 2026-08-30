import { Lock, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Achievement } from "@/lib/achievements";

/**
 * Milestones, earned ones first.
 *
 * A locked row shows its progress bar so it reads as something in motion
 * rather than something withheld, and every name is legible without the
 * icon - the trophy and the padlock repeat the state that the styling and
 * the progress text already carry, so both are aria-hidden.
 */
export function AchievementShelf({
  items,
  heading,
  help,
}: Readonly<{ items: readonly Achievement[]; heading: string; help: string }>) {
  const ordered = [...items].sort((a, b) => Number(b.earned) - Number(a.earned));
  const earned = items.filter((item) => item.earned).length;

  return (
    <section aria-labelledby="achievements-heading">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h2 id="achievements-heading" className="font-semibold">
          {heading}
        </h2>
        <p className="text-muted-foreground font-display text-sm tabular-nums">
          {earned}/{items.length}
        </p>
      </div>
      <p className="text-muted-foreground mb-3 text-sm">{help}</p>

      <ul className="grid grid-cols-2 gap-2">
        {ordered.map((item) => (
          <li key={item.id}>
            <Card
              className={cn(
                "h-full gap-1 p-3 transition-colors",
                item.earned ? "border-primary/40 bg-primary/5" : "opacity-70",
              )}
            >
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                {item.earned ? (
                  <Trophy aria-hidden="true" className="text-primary size-3.5 shrink-0" />
                ) : (
                  <Lock aria-hidden="true" className="text-muted-foreground size-3.5 shrink-0" />
                )}
                <span className="min-w-0 truncate">{item.name}</span>
              </p>
              <p className="text-muted-foreground text-xs">{item.blurb}</p>

              {item.earned || item.progress.goal === 1 ? null : (
                <div className="mt-1.5">
                  <div className="bg-muted h-1 overflow-hidden rounded-full">
                    <div
                      className="bg-primary/60 h-full rounded-full"
                      style={{ width: `${(item.progress.current / item.progress.goal) * 100}%` }}
                    />
                  </div>
                  <p className="text-muted-foreground mt-1 text-[10px] tabular-nums">
                    {item.progress.current} / {item.progress.goal}
                  </p>
                </div>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
