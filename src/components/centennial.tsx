/**
 * The hundredth entry, and nothing else.
 *
 * Confetti on every save would make the app read as a joke rather than as
 * something a vet might be shown, so the one flourish it gets is saved for a
 * number nobody reaches by accident. Hidden outright under reduced motion.
 */
export function Centennial({ show }: Readonly<{ show: boolean }>) {
  if (!show) {
    return null;
  }
  return (
    <span
      aria-hidden="true"
      className="animate-arc pointer-events-none fixed bottom-20 left-1/2 z-50 text-6xl select-none"
    >
      💩
    </span>
  );
}
