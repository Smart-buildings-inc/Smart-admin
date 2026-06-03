import BrandMark from "@/components/BrandMark";

export default function LogoLoader({
  compact = false,
  showWordmark = true,
}: {
  compact?: boolean;
  showWordmark?: boolean;
}) {
  return (
    <div
      className={`splash-stack flex w-full flex-col items-center text-center ${
        compact ? "max-w-[10rem] gap-2.5" : "max-w-[15rem] gap-4"
      }`}
    >
      <div
        className={`splash-ring grid place-items-center rounded-[1.15rem] ${
          compact ? "h-14 w-14" : "h-20 w-20 sm:h-24 sm:w-24"
        }`}
      >
        <BrandMark
          className={`splash-brand ${
            compact ? "h-11 w-11" : "h-16 w-16 sm:h-20 sm:w-20"
          }`}
        />
      </div>

      {showWordmark && (
        <div className="flex flex-col items-center gap-3">
          <div
            className={`gradient-text-soft font-extrabold tracking-[0] ${
              compact ? "text-sm" : "text-xl sm:text-2xl"
            }`}
          >
            ATLAS&nbsp;OS
          </div>
          <div
            className={`splash-progress h-px overflow-hidden rounded-full bg-ink-700/50 ${
              compact ? "w-20" : "w-32"
            }`}
          >
            <span aria-hidden className="block h-full rounded-full" />
          </div>
        </div>
      )}
    </div>
  );
}
