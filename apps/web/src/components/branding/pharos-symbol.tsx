import { useId } from 'react';

/** Vector interpretation of the supplied folded Pharos mark; reusable independently of the login. */
export function PharosSymbol({ className }: { className?: string }): React.JSX.Element {
  const id = useId();
  return (
    <svg viewBox="0 0 580 860" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient
          id={`${id}-front`}
          x1="80"
          y1="230"
          x2="430"
          y2="650"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#16b7ee" />
          <stop offset="1" stopColor="#0062eb" />
        </linearGradient>
        <linearGradient
          id={`${id}-side`}
          x1="30"
          y1="370"
          x2="260"
          y2="730"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#08318b" />
          <stop offset="1" stopColor="#0056d8" />
        </linearGradient>
        <linearGradient
          id={`${id}-tower`}
          x1="365"
          y1="0"
          x2="570"
          y2="480"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#219cff" />
          <stop offset="1" stopColor="#005beb" />
        </linearGradient>
      </defs>
      <path
        d="M370 5C373-3 385-1 398 7C505 64 568 164 574 275L574 632C574 680 550 714 516 735L448 774C432 783 421 771 421 750L421 296C421 245 402 222 377 195C370 187 370 176 370 162Z"
        fill={`url(#${id}-tower)`}
      />
      <path
        d="M421 249C421 236 418 226 414 216L559 365C570 377 574 391 574 415V632C574 680 550 714 516 735L448 774C432 783 421 771 421 750Z"
        fill={`url(#${id}-front)`}
      />
      <path
        d="M222 214C222 202 227 194 236 188L271 167C282 160 291 162 301 168L342 194C352 201 360 213 360 227V353C360 367 350 374 338 367L238 306C227 299 222 290 222 278Z"
        fill={`url(#${id}-front)`}
      />
      <path
        d="M0 385C0 360 8 343 23 335L128 273C140 266 148 267 160 274L329 377C349 389 360 406 360 429V661C360 679 349 685 335 676L242 620C229 612 222 600 222 585V466C222 447 211 433 194 423L151 397V758C151 771 147 777 137 783L26 848C10 858 0 848 0 831Z"
        fill={`url(#${id}-side)`}
      />
      <path
        d="M23 335L128 273C140 266 148 267 160 274L329 377C349 389 360 406 360 429V554C354 534 344 521 327 511L48 343C38 337 30 335 23 335Z"
        fill={`url(#${id}-front)`}
      />
    </svg>
  );
}
