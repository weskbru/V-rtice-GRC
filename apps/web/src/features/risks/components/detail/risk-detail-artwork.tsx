import { useId } from 'react';

import styles from './risk-detail-visual.module.css';

/** Atmospheric terrain, deliberately independent of risk state and navigation. */
export function RiskDetailArtwork(): React.JSX.Element {
  const id = useId().replace(/:/g, '');
  return (
    <div className={styles.artwork} aria-hidden="true">
      <svg viewBox="0 0 1000 250" preserveAspectRatio="none" focusable="false">
        <defs>
          <linearGradient id={`${id}-far`} x2="0" y2="1">
            <stop stopColor="var(--mountain-far)" stopOpacity=".48" />
            <stop offset="1" stopColor="var(--mountain-far)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${id}-mid`} x2=".2" y2="1">
            <stop stopColor="var(--mountain-mid)" stopOpacity=".45" />
            <stop offset="1" stopColor="var(--mountain-mid)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${id}-near`} x2=".4" y2="1">
            <stop stopColor="var(--mountain-near)" stopOpacity=".4" />
            <stop offset="1" stopColor="var(--mountain-near)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${id}-light`} x2=".6" y2="1">
            <stop stopColor="var(--mountain-light)" stopOpacity=".6" />
            <stop offset="1" stopColor="var(--mountain-light)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0 201 Q98 170 177 186 L257 143 285 148 341 110 368 118 414 81 441 99 475 115 509 107 543 139 Q575 148 605 124 L643 91 678 70 703 87 734 113 763 121 795 96 817 103 863 130 904 118 950 151 1000 162 V250 H0Z"
          fill={`url(#${id}-far)`}
        />
        <path
          d="M85 230 Q182 192 242 196 L292 163 313 168 350 132 375 139 405 114 432 134 Q469 165 506 149 L544 114 565 109 591 69 604 62 629 30 646 44 652 60 672 76 687 102 706 110 733 136 755 147 792 114 809 94 824 115 842 126 861 157 890 162 924 186 967 173 1000 182 V250 H85Z"
          fill={`url(#${id}-mid)`}
        />
        <path
          d="M629 30 L635 65 647 84 640 99 660 125 645 121 622 97 611 104 599 126 574 138 591 110 607 91 613 67Z M809 94 L806 121 820 145 846 161 829 148 814 136 792 141 775 157 790 126Z M405 114 L410 139 431 158 444 184 416 160 399 151 378 176 360 178 389 143Z"
          fill={`url(#${id}-light)`}
        />
        <path
          d="M629 30 Q624 72 633 90 L621 106 604 118 595 141 571 167 607 154 625 132 641 127 661 147 697 164 668 130 654 113 649 86Z M809 94 L816 120 824 128 832 155 852 177 824 165 809 143 790 163 767 176 794 136Z"
          fill={`url(#${id}-near)`}
        />
        <path
          d="M0 244 Q152 216 238 222 L294 201 323 192 347 199 374 183 395 191 421 211 Q469 230 507 194 L533 175 558 178 587 152 605 159 622 177 649 168 674 186 Q704 207 731 191 L758 178 782 185 809 163 828 176 847 180 879 204 919 191 949 206 1000 201 V250 H0Z"
          fill={`url(#${id}-near)`}
        />
      </svg>
    </div>
  );
}
