// A canvas with nothing on it yet: where work comes from, and how to see it full.
export function Empty() {
  return (
    <div className="pointer-events-none fixed inset-0 grid place-items-center pb-24">
      <div className="max-w-[440px] px-6 text-center" style={{ animation: "wb-empty 500ms var(--ease-out) both" }}>
        <div className="text-[30px] font-semibold tracking-[-0.02em] text-[var(--ink)]">Nothing here yet</div>
        <p className="mt-3 text-[15px] leading-[1.5] text-[var(--muted)]">
          When a Claude session shows you a screen, publishes a page or pushes to main, it lands here, under its project.
        </p>
        <p className="type-mono pointer-events-auto mt-6 select-all text-[13px] text-[var(--quiet)]">npx rounds-app --demo</p>
      </div>
      <style>{"@keyframes wb-empty { from { opacity: 0; transform: translateY(6px) } }"}</style>
    </div>
  );
}
