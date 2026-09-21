import { useId } from 'react';

import styles from './risk-register-artwork.module.css';

/** Editorial navigation landscape. Decorative and independent of risk data. */
export function RiskRegisterArtwork(): React.JSX.Element {
  const id = useId().replace(/:/g, '');
  return (
    <div aria-hidden="true" className={styles.artwork}>
      <svg
        viewBox="0 0 1200 280"
        preserveAspectRatio="none"
        focusable="false"
        className={styles.mountains}
      >
        <defs>
          <linearGradient id={`${id}-slope`} x1="0" y1="0" x2=".6" y2="1">
            <stop stopColor="var(--landscape-near)" stopOpacity=".19" />
            <stop offset="1" stopColor="var(--landscape-near)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${id}-snow`} x2=".3" y2="1">
            <stop stopColor="var(--compass-highlight)" stopOpacity=".48" />
            <stop offset="1" stopColor="var(--compass-highlight)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${id}-distance`} x2="0" y2="1">
            <stop stopColor="var(--landscape-far)" stopOpacity=".28" />
            <stop offset=".8" stopColor="var(--landscape-far)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${id}-ridge`} x2="0" y2="1">
            <stop stopColor="var(--landscape-ridge)" stopOpacity=".46" />
            <stop offset=".55" stopColor="var(--landscape-ridge)" stopOpacity=".17" />
            <stop offset="1" stopColor="var(--landscape-ridge)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${id}-near`} x2="0" y2="1">
            <stop stopColor="var(--landscape-near)" stopOpacity=".4" />
            <stop offset=".4" stopColor="var(--landscape-near)" stopOpacity=".16" />
            <stop offset="1" stopColor="var(--landscape-ridge)" stopOpacity=".02" />
          </linearGradient>
        </defs>
        {/* Distant ridges stay above the indicator row, where their depth is visible. */}
        <path
          d="M0 165 C104 151 155 167 228 146 S337 112 383 130 C426 144 458 96 494 105 Q535 117 584 82 L619 63 Q633 61 647 50 L668 69 680 72 Q705 99 733 69 L762 52 781 32 Q789 35 801 48 L813 50 837 72 Q858 87 880 80 L910 67 927 70 940 64 Q966 81 981 96 L1017 85 1050 66 1077 55 1093 63 Q1147 103 1200 93 V280 H0Z"
          fill={`url(#${id}-distance)`}
        />
        <path
          d="M0 219 C81 212 149 195 210 211 S326 178 385 180 C429 176 466 135 496 123 L530 95 548 79 561 74 578 50 Q587 55 595 67 L607 75 615 85 628 87 Q651 111 676 101 L701 82 712 80 728 65 740 70 751 83 766 89 Q785 114 812 125 C850 139 884 133 916 154 C950 174 987 147 1019 166 S1099 202 1130 175 S1175 154 1200 165 V280 H0Z"
          fill={`url(#${id}-ridge)`}
        />
        <path
          d="M350 235 C404 203 440 211 475 185 C502 166 521 155 541 126 C554 114 573 112 578 93 C579 86 569 79 578 50 C597 60 610 83 628 87 C614 90 615 104 622 110 C640 123 655 111 676 129 C694 140 711 153 738 156 C775 161 793 183 830 191 S914 209 961 187 S1014 173 1052 205 S1123 194 1200 225 V280 H350Z"
          fill={`url(#${id}-near)`}
        />
        <path
          d="M0 174 C103 159 168 166 244 151 S335 132 388 142 Q435 151 475 129 L492 118 506 124 521 125 Q558 146 585 125 L618 103 632 100 650 84 664 91 678 108 694 112 Q716 132 737 117 L762 105 775 90 792 85 802 77 814 89 822 91 843 110 Q861 122 882 114 L919 104 933 88 947 94 958 90 981 113 Q1010 137 1045 122 L1085 113 1107 101 1123 108 1134 107 Q1167 130 1200 117 V280 H0Z"
          fill={`url(#${id}-near)`}
        />
        <path
          d="M578 50 L587 81 605 105 599 110 615 136 590 120 577 99 563 107 549 124 529 130 550 102 570 86Z M728 65 L739 88 753 99 748 103 775 131 744 117 731 98 717 103 697 118 710 92Z M802 77 L809 104 824 114 820 126 845 151 811 133 796 111 779 118 753 136 774 110Z"
          fill={`url(#${id}-snow)`}
        />
        <path
          d="M578 50 Q576 80 585 94 L575 106 568 123 549 139 533 160 561 141 584 133 596 113 612 130 640 144 615 113 601 93Z M650 84 L652 111 672 131 681 159 659 140 639 130 625 150 607 159 631 124Z M802 77 L802 108 817 135 836 147 856 172 823 151 802 144 787 128 776 144 754 152 775 127Z M933 88 L936 112 949 125 970 135 983 152 951 141 929 126 917 140 895 149 920 119Z M1107 101 L1104 119 1127 143 1151 150 1123 130 1120 116Z"
          fill={`url(#${id}-slope)`}
        />
        <path
          d="M0 190 C127 177 204 179 280 170 S400 154 451 162 C499 167 539 132 574 139 S628 156 663 143 C704 127 725 116 755 130 S805 154 844 139 C886 122 907 130 938 144 S1008 143 1056 132 S1140 151 1200 137 V280 H0Z"
          fill={`url(#${id}-near)`}
          opacity=".72"
        />
      </svg>
      <svg viewBox="0 0 220 220" focusable="false" className={styles.compass}>
        <defs>
          <linearGradient id={`${id}-metal`} x2=".8" y2="1">
            <stop stopColor="var(--compass-highlight)" />
            <stop offset=".5" stopColor="var(--compass-ink)" />
            <stop offset="1" stopColor="var(--compass-highlight)" />
          </linearGradient>
          <radialGradient id={`${id}-face`} cx="35%" cy="28%" r="75%">
            <stop stopColor="var(--compass-highlight)" stopOpacity=".55" />
            <stop offset="1" stopColor="var(--compass-ink)" stopOpacity=".05" />
          </radialGradient>
        </defs>
        <g transform="rotate(16 110 110)">
          <circle
            cx="110"
            cy="110"
            r="82"
            fill={`url(#${id}-face)`}
            stroke="var(--compass-ink)"
            strokeWidth=".6"
            opacity=".6"
          />
          <circle
            cx="110"
            cy="113"
            r="77"
            fill="none"
            stroke="var(--compass-ink)"
            strokeWidth="5"
            opacity=".13"
          />
          <circle
            cx="110"
            cy="110"
            r="77"
            fill="none"
            stroke={`url(#${id}-metal)`}
            strokeWidth="3.5"
          />
          <circle
            cx="110"
            cy="110"
            r="68"
            fill="var(--compass-highlight)"
            fillOpacity=".08"
            stroke="var(--compass-ink)"
            strokeWidth=".8"
          />
          <circle
            cx="110"
            cy="110"
            r="58"
            fill="none"
            stroke="var(--compass-ink)"
            strokeWidth=".6"
            opacity=".45"
          />
          {Array.from({ length: 64 }, (_, i) => (
            <path
              key={i}
              d={i % 8 === 0 ? 'M110 39 V49' : i % 2 === 0 ? 'M110 40 V45' : 'M110 40 V43'}
              transform={`rotate(${i * 5.625} 110 110)`}
              stroke="var(--compass-ink)"
              strokeWidth={i % 8 === 0 ? 1.8 : 0.8}
              opacity={i % 8 === 0 ? 0.9 : 0.55}
            />
          ))}
          <g className={styles.instrumentDetails} fill="none" stroke="var(--compass-ink)">
            <circle cx="110" cy="110" r="73" strokeWidth=".45" />
            <circle cx="110" cy="110" r="61" strokeWidth=".5" strokeDasharray="1 3" />
            <circle cx="110" cy="110" r="25" strokeWidth=".6" />
            {Array.from({ length: 48 }, (_, i) => (
              <path
                key={i}
                d={i % 3 === 0 ? 'M110 54 V59' : 'M110 54 V56'}
                transform={`rotate(${i * 7.5} 110 110)`}
                strokeWidth=".65"
              />
            ))}
            {[0, 90, 180, 270].map((angle) => (
              <g key={angle} transform={`rotate(${angle} 110 110)`}>
                <path d="M102 34 Q110 31 118 34 M103 36 Q110 34 117 36" strokeWidth=".7" />
                <circle cx="110" cy="30" r="1.6" strokeWidth=".7" />
                <path d="M107 51 L110 47 L113 51" strokeWidth=".7" />
              </g>
            ))}
          </g>
          {[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map((angle) => (
            <g key={angle} transform={`rotate(${angle} 110 110)`} opacity=".25">
              <path d="M110 75 L114 102 L110 110 L106 102Z" fill="var(--compass-ink)" />
              <path d="M110 75 V110 L106 102Z" fill="var(--compass-highlight)" />
            </g>
          ))}
          <path
            d="M110 24 V196 M24 110 H196"
            stroke="var(--compass-ink)"
            strokeWidth=".7"
            opacity=".5"
          />
          {[45, 135, 225, 315].map((angle) => (
            <g key={angle} transform={`rotate(${angle} 110 110)`}>
              <path
                d="M110 62 L114 85 L119 101 L110 110 L101 101 L106 85Z"
                fill="var(--compass-ink)"
                opacity=".38"
              />
              <path
                d="M110 62 V110 L101 101 L106 85Z"
                fill="var(--compass-highlight)"
                opacity=".7"
              />
              <path d="M110 74 L112 94 L110 101 L108 94Z" fill="var(--compass-ink)" opacity=".2" />
            </g>
          ))}
          {[0, 90, 180, 270].map((angle) => (
            <g key={angle} transform={`rotate(${angle} 110 110)`}>
              <path
                d="M106 28 V22 Q110 15 114 22 V28 M107 24 H113"
                fill="none"
                stroke="var(--compass-ink)"
                strokeWidth="1.3"
                opacity=".65"
              />
              <path
                d="M110 48 L115 77 L123 99 L117 104 L110 110 L103 104 L97 99 L105 77Z"
                fill="var(--compass-ink)"
                opacity={angle === 0 || angle === 90 ? '.9' : '.65'}
              />
              <path
                d="M110 48 V110 L103 104 L97 99 L105 77Z"
                fill="var(--compass-highlight)"
                opacity=".9"
              />
              <path
                d="M110 65 L112 86 L117 99 L110 104 L103 99 L108 86Z"
                fill="none"
                stroke="var(--compass-ink)"
                strokeWidth=".6"
                opacity=".35"
              />
              <path
                d="M108 25 L110 20 L112 25"
                fill="none"
                stroke="var(--compass-ink)"
                strokeWidth="1"
              />
            </g>
          ))}
          <g transform="rotate(35 110 110)">
            <path d="M110 12 L116 105 L110 119 L104 105Z" fill="var(--compass-ink)" opacity=".6" />
            <path d="M110 12 V119 L104 105Z" fill="var(--compass-highlight)" />
            <path
              d="M110 119 L113 189 L110 199 L107 189Z"
              fill="var(--compass-ink)"
              opacity=".45"
            />
          </g>
          <circle
            cx="110"
            cy="110"
            r="10"
            fill="var(--compass-highlight)"
            stroke="var(--compass-ink)"
            strokeWidth="1.5"
          />
          <circle cx="110" cy="110" r="4" fill="var(--compass-ink)" opacity=".7" />
          <circle
            cx="110"
            cy="110"
            r="7"
            fill="none"
            stroke="var(--compass-ink)"
            strokeWidth=".65"
            opacity=".55"
          />
          <path d="M108 109 L112 111" stroke="var(--compass-highlight)" strokeWidth=".8" />
          <circle
            cx="110"
            cy="110"
            r="14"
            fill="none"
            stroke="var(--compass-ink)"
            strokeWidth=".6"
            opacity=".5"
          />
        </g>
      </svg>
      <div className={styles.mist} />
    </div>
  );
}
