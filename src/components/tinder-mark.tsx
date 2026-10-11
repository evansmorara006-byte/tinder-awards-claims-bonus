import { useId } from "react";

export function TinderMark({ className = "size-8" }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="6" y1="30" x2="26" y2="2" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF7854" />
          <stop offset="48%" stopColor="#FF5864" />
          <stop offset="100%" stopColor="#FD267A" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id})`}
        d="M18.2 1.4c-.8 3.8-4.8 7-6.6 8.2-.6.4-.2 1.4.6 1.2 2.4-.4 5.4-2.6 6.6-5.2.6 2.2.2 4.6-1.2 6.6 3.2 1.6 6.8 5.2 6.8 9.8 0 5.6-4.8 9.6-10.4 9.6S4 27.6 4 22c0-4.6 3-8.6 6.4-11-.8 2.4.2 4.8 1.8 6.4.4.4 1.2 0 1-.6-.4-2.2-1-5-1.6-7C13.6 6.6 16.8 2.8 18.2 1.4Z"
      />
    </svg>
  );
}
