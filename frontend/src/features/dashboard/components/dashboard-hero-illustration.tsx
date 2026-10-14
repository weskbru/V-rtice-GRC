import styles from './dashboard-hero-illustration.module.css';

export interface DashboardHeroIllustrationProps {
  className?: string;
}

export function DashboardHeroIllustration({
  className,
}: DashboardHeroIllustrationProps): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className={`${styles.artwork} pointer-events-none absolute inset-0 select-none ${className ?? ''}`}
    >
      <svg
        viewBox="0 0 1200 180"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
        className={styles.geometry}
      >
        <path
          d="M420 170 L610 65 L780 135 L965 30 L1200 100"
          fill="none"
          stroke="var(--hero-line)"
          strokeWidth="2"
          opacity=".35"
        />
        <path
          d="M520 180 L710 105 L870 170 L1060 70 L1200 125"
          fill="none"
          stroke="var(--hero-line)"
          opacity=".18"
        />
        <g transform="translate(895 25) scale(1.4)" opacity=".32">
          <path d="M12 16 H33 L57 88 H43 Z" fill="var(--hero-ink)" />
          <path d="M67 16 H88 L57 88 H43 Z" fill="var(--hero-line)" />
        </g>
        <g fill="var(--hero-line)" opacity=".5">
          <circle cx="610" cy="65" r="4" />
          <circle cx="780" cy="135" r="4" />
          <circle cx="965" cy="30" r="4" />
        </g>
      </svg>
    </div>
  );
}
