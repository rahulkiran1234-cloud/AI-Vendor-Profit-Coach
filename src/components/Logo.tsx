export function Logo({ size = 32 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
        <rect width="40" height="40" rx="11" fill="url(#logo-gradient)" />
        <path
          d="M13 24.5c1.8-6.5 5.6-10 11.5-10.5"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M20.5 14.5 24.7 13.6 25 17.9"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="13" cy="24.5" r="2.1" fill="white" />
        <defs>
          <linearGradient id="logo-gradient" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#34B155" />
            <stop offset="1" stopColor="#145F2C" />
          </linearGradient>
        </defs>
      </svg>
      <span className="font-heading text-lg font-bold tracking-tight">Profit Coach</span>
    </div>
  );
}
