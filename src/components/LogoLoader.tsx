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
        compact ? "max-w-[11rem] gap-3" : "max-w-[18rem] gap-5"
      }`}
    >
      <div
        className={`splash-ring grid place-items-center rounded-[1.15rem] ${
          compact ? "h-16 w-16" : "h-24 w-24 sm:h-28 sm:w-28"
        }`}
      >
        <BrandMark
          className={`splash-brand ${
            compact ? "h-12 w-12" : "h-20 w-20 sm:h-24 sm:w-24"
          }`}
        />
      </div>

      {showWordmark && (
        <div className="flex flex-col items-center gap-3">
          <div
            className={`gradient-text-soft font-extrabold tracking-[0] ${
              compact ? "text-base" : "text-2xl sm:text-3xl"
            }`}
          >
            ATLAS&nbsp;OS
          </div>
          <div
            className={`splash-progress h-1 overflow-hidden rounded-full bg-ink-700/70 ${
              compact ? "w-24" : "w-40"
            }`}
          >
            <span aria-hidden className="block h-full rounded-full" />
          </div>
        </div>
      )}
    </div>
  );
}
