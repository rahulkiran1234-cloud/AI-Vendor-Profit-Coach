export function LoadingSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-foreground-secondary">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}
