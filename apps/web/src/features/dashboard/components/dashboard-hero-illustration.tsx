import { useId } from 'react';

import styles from './dashboard-hero-illustration.module.css';

export interface DashboardHeroIllustrationProps {
  className?: string;
}

/** Decorative landscape only. The tower keeps its aspect ratio independently of the hills. */
export function DashboardHeroIllustration({
  className,
}: DashboardHeroIllustrationProps): React.JSX.Element {
  const id = useId().replace(/:/g, '');
  const paint = (name: string) => `url(#${id}-${name})`;

  return (
    <div
      aria-hidden="true"
      className={`${styles.artwork} pointer-events-none absolute inset-0 select-none ${className ?? ''}`}
    >
      <svg
        viewBox="0 0 1200 180"
        preserveAspectRatio="none"
        focusable="false"
        className={styles.landscape}
      >
        <defs>
          <linearGradient id={`${id}-distance`} x2="0" y2="1">
            <stop stopColor="var(--hero-mountain)" stopOpacity=".22" />
            <stop offset="1" stopColor="var(--hero-mountain)" stopOpacity=".04" />
          </linearGradient>
          <linearGradient id={`${id}-terrain`} x2="0" y2="1">
            <stop stopColor="var(--hero-mountain)" stopOpacity=".38" />
            <stop offset="1" stopColor="var(--hero-mountain)" stopOpacity=".09" />
          </linearGradient>
        </defs>
        {/* Long, irregular curved ridges: atmospheric perspective, never polygonal peaks. */}
        <path
          fill={paint('distance')}
          d="M0 151 C80 140 120 154 186 139 S280 111 336 123 S427 107 474 114 C528 123 560 78 594 89 S651 130 693 111 C736 90 762 45 791 57 S839 106 870 93 C910 76 934 112 963 97 S1034 53 1062 68 S1140 113 1200 101 V180 H0Z"
        />
        <path
          fill={paint('distance')}
          d="M0 165 C108 154 153 162 228 147 S339 131 390 143 C444 154 478 118 516 126 S572 154 613 139 C662 121 688 91 716 103 S769 129 801 106 C842 73 863 78 893 99 S943 134 977 120 C1036 95 1064 107 1100 128 S1160 136 1200 119 V180 H0Z"
        />
        <path
          fill={paint('terrain')}
          d="M0 177 C118 167 156 178 233 163 S342 150 393 159 S466 150 503 156 C557 163 600 144 638 147 S692 132 726 142 C765 150 791 125 817 135 S867 162 905 146 C943 130 957 113 979 127 S1020 151 1056 146 S1121 157 1200 143 V180 H0Z"
        />
        <path
          fill="var(--hero-mountain)"
          opacity=".12"
          d="M0 178 C203 165 322 185 480 171 S688 165 789 163 S987 179 1200 163 V180 H0Z"
        />
      </svg>
      {/* Fixed-ratio local scene keeps beam, lantern and rock footing aligned at every width. */}
      <svg viewBox="0 0 760 190" focusable="false" className={styles.lighthouse}>
        <defs>
          <linearGradient id={`${id}-beam`} x1="1" y1=".5" x2="0" y2=".5">
            <stop stopColor="var(--hero-light)" stopOpacity=".78" />
            <stop offset=".48" stopColor="var(--hero-light)" stopOpacity=".25" />
            <stop offset="1" stopColor="var(--hero-light)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${id}-tower`}>
            <stop stopColor="var(--hero-stone-light)" />
            <stop offset=".5" stopColor="var(--hero-stone)" />
            <stop offset="1" stopColor="var(--hero-shadow)" />
          </linearGradient>
          <linearGradient id={`${id}-rock`} x2=".3" y2="1">
            <stop stopColor="var(--hero-stone)" />
            <stop offset="1" stopColor="var(--hero-mountain)" stopOpacity=".2" />
          </linearGradient>
          <filter id={`${id}-soft`} x="-5%" y="-20%" width="110%" height="140%">
            <feGaussianBlur stdDeviation="1.4" />
          </filter>
        </defs>
        <path
          className={styles.beam}
          d="M529 49 L30 -28 Q-4 57 28 128 Z"
          fill={paint('beam')}
          filter={paint('soft')}
        />
        {/* Promontory and individually rounded stones anchor the tower. */}
        <path
          d="M379 187 C395 179 414 181 426 173 C437 163 448 174 458 166 C467 149 481 157 490 151 C502 135 514 149 524 147 C533 136 549 138 558 147 C568 134 581 142 587 153 C600 148 608 161 619 160 C630 150 641 166 650 170 C669 167 683 180 705 187Z"
          fill={paint('rock')}
        />
        <path d="M509 146 L519 69 H539 L550 146 Q532 152 509 146Z" fill={paint('tower')} />
        <path d="M519 70 H526 L521 145 L509 146Z" fill="var(--hero-stone-light)" opacity=".65" />
        <path d="M535 71 L539 71 L550 146 L538 148Z" fill="var(--hero-shadow)" opacity=".24" />
        <path
          d="M521 92 H525 V101 H520Z M524 114 H528 V123 H523Z"
          fill="var(--hero-detail)"
          opacity=".75"
        />
        <path d="M530 135 Q530 131 533 131 Q536 131 536 135 V146 H530Z" fill="var(--hero-detail)" />
        <path
          d="M517 76 H541 M514 113 H544"
          stroke="var(--hero-stone-light)"
          strokeWidth="1.1"
          opacity=".6"
        />
        {/* Corbel, gallery floor and fine railing. */}
        <path d="M513 66 H545 L540 73 H518Z" fill="var(--hero-shadow)" />
        <path d="M510 63 H548 V67 H510Z" fill="var(--hero-detail)" />
        <path
          d="M512 56 V63 M518 56 V63 M525 56 V63 M533 56 V63 M541 56 V63 M546 56 V63 M512 57 H546"
          fill="none"
          stroke="var(--hero-detail)"
          strokeWidth=".9"
        />
        {/* Glazed lantern, roof, cupola and finial. */}
        <path d="M520 39 H538 V61 H520Z" fill="var(--hero-light)" opacity=".85" />
        <path
          d="M520 39 H525 V61 H520Z M533 39 H538 V61 H533Z"
          fill="var(--hero-stone)"
          opacity=".7"
        />
        <path
          d="M520 39 V61 M526 39 V61 M532 39 V61 M538 39 V61 M519 60 H539 M520 48 H538"
          stroke="var(--hero-detail)"
          strokeWidth="1"
          fill="none"
        />
        <path d="M516 39 Q521 34 527 30 H531 Q536 34 542 39Z" fill="var(--hero-shadow)" />
        <path d="M518 38 L528 31 L526 38Z" fill="var(--hero-stone-light)" />
        <path
          d="M527 30 Q527 27 529 27 Q531 27 531 30 M529 27 V23"
          stroke="var(--hero-detail)"
          strokeWidth="1"
          fill="none"
        />
        <path d="M517 40 H541" stroke="var(--hero-detail)" strokeWidth="1.5" />
        <path
          d="M455 178 Q460 161 473 164 L482 180 M484 171 Q491 153 503 159 L512 176 M547 174 Q553 153 565 160 L574 179 M588 181 Q594 166 606 170 L617 185"
          fill="var(--hero-stone)"
          opacity=".65"
        />
        <path
          d="M410 187 Q463 175 482 182 T538 180 T596 186 T659 188"
          stroke="var(--hero-stone-light)"
          strokeWidth="2"
          opacity=".45"
          fill="none"
        />
      </svg>
    </div>
  );
}
