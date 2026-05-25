import * as React from "react";

// Theme-aware (currentColor) logos with a filled state (selected) and an
// outline state (unselected).

type LogoProps = { className?: string; filled?: boolean };

// Python two-snake mark.
export function PythonLogo({ className, filled = true }: LogoProps) {
  const paint = filled
    ? { fill: "currentColor" }
    : { fill: "none", stroke: "currentColor", strokeWidth: 9 };
  return (
    <svg
      viewBox="0 0 256 255"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid"
      aria-hidden
    >
      <path
        {...paint}
        d="M126.916.072c-64.832 0-60.784 28.115-60.784 28.115l.072 29.128h61.868v8.745H41.631S.145 61.355.145 126.77c0 65.417 36.21 63.097 36.21 63.097h21.61v-30.356s-1.165-36.21 35.632-36.21h61.362s34.475.557 34.475-33.319V33.97S232.762.072 126.916.072zM92.802 19.66a11.12 11.12 0 0 1 11.13 11.13 11.12 11.12 0 0 1-11.13 11.13 11.12 11.12 0 0 1-11.13-11.13 11.12 11.12 0 0 1 11.13-11.13z"
      />
      <path
        {...paint}
        d="M128.757 254.126c64.832 0 60.784-28.115 60.784-28.115l-.072-29.128h-61.868v-8.745h86.441s41.486 4.705 41.486-60.711c0-65.416-36.21-63.096-36.21-63.096h-21.61v30.355s1.165 36.21-35.632 36.21h-61.362s-34.475-.557-34.475 33.32v56.013s-5.235 33.897 100.61 33.897zm34.114-19.586a11.12 11.12 0 0 1-11.13-11.13 11.12 11.12 0 0 1 11.13-11.131 11.12 11.12 0 0 1 11.13 11.13 11.12 11.12 0 0 1-11.13 11.13z"
      />
    </svg>
  );
}

// SQL / database mark (cylinder).
export function SqlLogo({ className, filled = true }: LogoProps) {
  if (filled) {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        fill="currentColor"
        aria-hidden
      >
        <path
          d="M12 2c4.418 0 8 1.343 8 3v14c0 1.657-3.582 3-8 3s-8-1.343-8-3V5c0-1.657 3.582-3 8-3z"
          opacity="0.85"
        />
        <ellipse cx="12" cy="5" rx="8" ry="3" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.657 3.582 3 8 3s8-1.343 8-3V5" />
      <path d="M4 12c0 1.657 3.582 3 8 3s8-1.343 8-3" />
    </svg>
  );
}
