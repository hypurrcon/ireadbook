import type { SVGProps } from 'react';

const P: Record<string, string> = {
  shelf: 'M4 20h16M6 20V6M10 20V4M14 20l-2.2-13.5M17 20V8.5M20 20V8.5',
  read: 'M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5zM12 6.5V19.5',
  plus: 'M12 5v14M5 12h14',
  stats: 'M4 20V10M9.33 20V4M14.67 20v-7M20 20v-12',
  assistant: 'M5 5h14v10H10l-4 4v-4H5zM8.5 9h7M8.5 12h4.5',
  settings: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM19 12l2-1.2-1.6-3.2-2.3.6-1.5-1.3L15 4.5h-3.6l-.6 2.4-1.5 1.3-2.3-.6L5.4 10.8 7 12l-1.6 1.2L7 16.4l2.3-.6 1.5 1.3.6 2.4H15l.6-2.4 1.5-1.3 2.3.6 1.6-3.2z',
  back: 'M15 5l-7 7 7 7',
  forward: 'M9 5l7 7-7 7',
  close: 'M6 6l12 12M18 6L6 18',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5L20 20',
  sort: 'M7 4v16M3.5 16.5L7 20l3.5-3.5M17 20V4M13.5 7.5L17 4l3.5 3.5',
  camera: 'M4 8h3l1.5-2.5h7L17 8h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  play: 'M8 5.5v13l10.5-6.5z',
  pause: 'M8 5.5v13M16 5.5v13',
  stop: 'M6.5 6.5h11v11h-11z',
  dice: 'M6.5 4.5h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2zM8.6 9a.9.9 0 1 0 1.8 0a.9.9 0 1 0-1.8 0M13.6 9a.9.9 0 1 0 1.8 0a.9.9 0 1 0-1.8 0M11.1 12a.9.9 0 1 0 1.8 0a.9.9 0 1 0-1.8 0M8.6 15a.9.9 0 1 0 1.8 0a.9.9 0 1 0-1.8 0M13.6 15a.9.9 0 1 0 1.8 0a.9.9 0 1 0-1.8 0',
  copy: 'M9 9h10v10H9zM15 9V5H5v10h4',
  share: 'M12 15V3.5M7.5 8L12 3.5 16.5 8M5 12v8h14v-8',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  trash: 'M5 7h14M10 7V4.5h4V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5',
  cube: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  soundOn: 'M4 9.5h4L13 5v14l-5-4.5H4zM16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11',
  soundOff: 'M4 9.5h4L13 5v14l-5-4.5H4zM16.5 9.5l5 5M21.5 9.5l-5 5',
  star: 'M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.7l-5.1 2.7 1-5.6-4.1-4 5.7-.8z',
  flame: 'M12 21c3.9 0 6.5-2.6 6.5-6.2 0-3.6-2.8-5.6-4-8.8-.4 2.2-1.6 3.4-2.9 3.9.4-2.6-.6-4.9-2.6-6.4.2 3.3-4.5 5.9-4.5 11.1C4.5 18.4 8.1 21 12 21z',
  phoneDown: 'M7 3h10v18H7zM10.5 18.5h3M4 12h1.5M18.5 12H20',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3.5 2',
  note: 'M5 4h10l4 4v12H5zM15 4v4h4M8 12h8M8 15.5h6',
  quote: 'M5 17c2.5-1 3.5-3 3.5-6H5V6.5h5V11c0 4-1.8 6.7-5 7.8zM14 17c2.5-1 3.5-3 3.5-6H14V6.5h5V11c0 4-1.8 6.7-5 7.8z',
  download: 'M12 4v11.5M7.5 11L12 15.5 16.5 11M5 19.5h14',
  upload: 'M12 15.5V4M7.5 8.5L12 4l4.5 4.5M5 19.5h14',
  calendar: 'M4.5 6h15v14h-15zM4.5 10h15M8.5 3.5v4M15.5 3.5v4',
  series: 'M4 6h4v14H4zM10 4h4v16h-4zM16 7h4v13h-4z',
  more: 'M5.5 12h.01M12 12h.01M18.5 12h.01',
  sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
  moon: 'M19.5 14.5A8 8 0 1 1 9.5 4.5a6.5 6.5 0 0 0 10 10z',
  barcode: 'M4 5v14M7 5v14M9.5 5v14M13 5v14M15 5v14M18 5v14M20 5v14',
  type: 'M5 6V4.5h14V6M12 4.5v15M9 19.5h6',
  refresh: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4v4.5H15',
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 22, sw = 1.6, filled, ...rest }: { name: IconName; size?: number; sw?: number; filled?: boolean } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  const fill = filled || name === 'play';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor"
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d={P[name]} />
    </svg>
  );
}
