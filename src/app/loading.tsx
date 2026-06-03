import LogoLoader from "@/components/LogoLoader";

export default function Loading() {
  return (
    <div
      data-testid="route-loading"
      role="status"
      aria-label="Loading ATLAS OS"
      className="splash-backdrop fixed inset-0 z-[90] grid place-items-center px-6"
    >
      <LogoLoader />
      <span className="sr-only">Loading ATLAS OS</span>
    </div>
  );
}
