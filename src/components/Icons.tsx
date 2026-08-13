interface SvgProps extends React.SVGAttributes<SVGSVGElement> {
  size?: number;
  sw?: number;
}

function Svg({ size = 24, sw = 1.6, children, ...rest }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {children}
    </svg>
  );
}

export const Icon = {
  criterios: (p: SvgProps) => (
    <Svg {...p}>
      <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1Z" />
      <path d="M8 6H6.5A1.5 1.5 0 0 0 5 7.5v11A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-11A1.5 1.5 0 0 0 17.5 6H16" />
      <path d="m8.8 13 1.9 1.9 3.9-3.9" />
    </Svg>
  ),
  testcase: (p: SvgProps) => (
    <Svg {...p}>
      <path d="M9 3h6" />
      <path d="M10 3v6.2L5.7 16.6A2 2 0 0 0 7.4 20h9.2a2 2 0 0 0 1.7-3.4L14 9.2V3" />
      <path d="M8.2 14.2h7.6" />
      <circle cx="13.2" cy="16.6" r=".6" fill="currentColor" stroke="none" />
    </Svg>
  ),
  designvalidator: (p: SvgProps) => (
    <Svg {...p}>
      <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
      <circle cx="8.5" cy="9.5" r="1.3" />
      <path d="m3.5 16 4.5-4 3.5 3.2" />
      <path d="m13.5 14.5 2 2 4-4" />
    </Svg>
  ),
  bug: (p: SvgProps) => (
    <Svg {...p}>
      <path d="M8.5 9a3.5 3.5 0 0 1 7 0v3.5a3.5 3.5 0 0 1-7 0V9Z" />
      <path d="M12 13v6.5" />
      <path d="M4.5 11H8M16 11h3.5" />
      <path d="M5 6.5 7.6 8.4M19 6.5 16.4 8.4" />
      <path d="M5 17.5 7.6 15.6M19 17.5 16.4 15.6" />
      <path d="M9.6 5.4 8.6 4M14.4 5.4 15.4 4" />
    </Svg>
  ),
  datos: (p: SvgProps) => (
    <Svg {...p}>
      <ellipse cx="12" cy="6" rx="6.5" ry="2.8" />
      <path d="M5.5 6v6c0 1.55 2.9 2.8 6.5 2.8s6.5-1.25 6.5-2.8V6" />
      <path d="M5.5 12v6c0 1.55 2.9 2.8 6.5 2.8s6.5-1.25 6.5-2.8v-6" />
    </Svg>
  ),
  eye: (p: SvgProps) => (
    <Svg sw={1.6} {...p}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  ),
  eyeOff: (p: SvgProps) => (
    <Svg sw={1.6} {...p}>
      <path d="M3 3l18 18" />
      <path d="M10.6 6.1A11 11 0 0 1 12 6c6 0 9.5 6 9.5 6a17.7 17.7 0 0 1-2.9 3.5M6.4 7.6A17.7 17.7 0 0 0 2.5 12S6 18 12 18a10.8 10.8 0 0 0 3.9-.7" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </Svg>
  ),
  sun: (p: SvgProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3.8" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
    </Svg>
  ),
  moon: (p: SvgProps) => (
    <Svg {...p}>
      <path d="M20 14.2A8 8 0 0 1 9.8 4 7 7 0 1 0 20 14.2Z" />
    </Svg>
  ),
  chevron: (p: SvgProps) => (<Svg sw={1.7} {...p}><path d="m6 9 6 6 6-6" /></Svg>),
  arrow: (p: SvgProps) => (<Svg sw={1.7} {...p}><path d="M5 12h13M12.5 6l6 6-6 6" /></Svg>),
  spark: (p: SvgProps) => (
    <Svg {...p}>
      <path d="M12 3.5 13.7 9 19.2 10.7 13.7 12.4 12 18 10.3 12.4 4.8 10.7 10.3 9Z" />
    </Svg>
  ),
  back: (p: SvgProps) => (<Svg sw={1.7} {...p}><path d="M19 12H6M12 18l-6-6 6-6" /></Svg>),
  sprint: (p: SvgProps) => (
    <Svg {...p}>
      <rect x="3" y="3" width="7" height="7" rx="1.2" />
      <rect x="14" y="3" width="7" height="7" rx="1.2" />
      <rect x="3" y="14" width="7" height="7" rx="1.2" />
      <rect x="14" y="14" width="7" height="7" rx="1.2" />
      <path d="M7 17v3M17 17v3M7 7v-3M17 7v-3" />
      <circle cx="7" cy="20" r="1.2" />
      <circle cx="17" cy="20" r="1.2" />
    </Svg>
  ),
  regression: (p: SvgProps) => (
    <Svg {...p}>
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v4h-4" />
      <path d="m8.8 12.5 2.2 2.2 4.2-4.2" />
    </Svg>
  ),
  userstory: (p: SvgProps) => (
    <Svg {...p}>
      <circle cx="12" cy="7" r="3.5" />
      <path d="M5.5 20v-2a4.5 4.5 0 0 1 4.5-4.5h4a4.5 4.5 0 0 1 4.5 4.5v2" />
      <path d="M16 5.5 17 3M8 5.5 7 3" />
      <path d="M12 3v2" />
    </Svg>
  ),
  refiner: (p: SvgProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      <circle cx="12" cy="4.5" r=".8" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19.5" r=".8" fill="currentColor" stroke="none" />
    </Svg>
  ),
  edgecase: (p: SvgProps) => (
    <Svg {...p}>
      <path d="M2 6h4l2-3h8l2 3h4v13a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2Z" />
      <circle cx="12" cy="13" r="3" />
      <path d="M4 6V4a2 2 0 0 1 2-2h.5M17.5 2h.5a2 2 0 0 1 2 2v2" />
      <path d="M12 7v1M10 11l-1.5 1.5M14 11l1.5 1.5" />
    </Svg>
  ),
  converter: (p: SvgProps) => (
    <Svg {...p}>
      <path d="M4 6h16M4 12h10M4 18h14" />
      <path d="M16 9.5 18 12l-2 2.5M12 15l-1.5 1.5M12 8l1.5 1.5" />
    </Svg>
  ),
};
