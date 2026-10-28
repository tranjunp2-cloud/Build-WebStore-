import type { SVGProps } from "react";

/**
 * Stroke icons for the assistant panel — Lucide geometry (24 grid, 2px
 * stroke) drawn inline so the package ships without an icon dependency.
 */
const PATHS = {
	bot: ["M12 8V4H8", "M2 14h2", "M20 14h2", "M15 13v2", "M9 13v2"],
	"chevron-down": ["m6 9 6 6 6-6"],
	"chevron-right": ["m9 18 6-6-6-6"],
	"list-checks": ["m3 17 2 2 4-4", "m3 7 2 2 4-4", "M13 6h8", "M13 12h8", "M13 18h8"],
	"square-pen": [
		"M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7",
		"M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z",
	],
	"maximize-2": ["M15 3h6v6", "m21 3-7 7", "m3 21 7-7", "M9 21H3v-6"],
	"minimize-2": ["m14 10 7-7", "M20 10h-6V4", "m3 21 7-7", "M4 14h6v6"],
	x: ["M18 6 6 18", "m6 6 12 12"],
	"circle-check": ["M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0Z", "m9 12 2 2 4-4"],
	"circle-alert": ["M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0Z", "M12 8v4", "M12 16h.01"],
	"message-circle-question": ["M7.9 20A9 9 0 1 0 4 16.1L2 22Z", "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3", "M12 17h.01"],
	"message-square-text": ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", "M13 8H7", "M17 12H7"],
	clock: ["M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20z", "M12 6v6l4 2"],
	square: ["M8.5 6h7A2.5 2.5 0 0 1 18 8.5v7a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 6 15.5v-7A2.5 2.5 0 0 1 8.5 6z"],
	paperclip: ["m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551"],
	package: [
		"M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z",
		"M12 22V12",
		"m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7",
		"m7.5 4.27 9 5.15",
	],
	newspaper: [
		"M15 18h-5",
		"M18 14h-8",
		"M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2",
		"M10 6h8v4h-8z",
	],
	"arrow-up": ["m5 12 7-7 7 7", "M12 19V5"],
	"arrow-up-right": ["M7 7h10v10", "M7 17 17 7"],
	upload: ["M12 3v12", "m17 8-5-5-5 5", "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"],
	images: [
		"m22 11-1.296-1.296a2.4 2.4 0 0 0-3.408 0L11 16",
		"M4 8a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2",
		"M14 2h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z",
	],
	image: ["M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z", "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"],
	"image-plus": [
		"M16 5h6",
		"M19 2v6",
		"M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5",
		"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21",
	],
	search: ["m21 21-4.34-4.34", "M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16z"],
	check: ["M20 6 9 17l-5-5"],
	"loader-circle": ["M21 12a9 9 0 1 1-6.219-8.56"],
	"rotate-cw": ["M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8", "M21 3v5h-5"],
	"rotate-ccw": ["M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", "M3 3v5h5"],
	"arrow-right": ["M5 12h14", "m12 5 7 7-7 7"],
	"file-text": [
		"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",
		"M14 2v4a2 2 0 0 0 2 2h4",
		"M10 9H8",
		"M16 13H8",
		"M16 17H8",
	],
	plus: ["M5 12h14", "M12 5v14"],
	ellipsis: [],
	inbox: [
		"M22 12h-6l-2 3h-4l-2-3H2",
		"M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
	],
	trash: ["M3 6h18", "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6", "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"],
	sparkles: [
		"M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z",
	],
	"undo-2": ["M9 14 4 9l5-5", "M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"],
	"chevron-left": ["m15 18-6-6 6-6"],
	type: ["M4 7V4h16v3", "M9 20h6", "M12 4v16"],
	"mouse-pointer-click": [
		"M14 4.1 12 6",
		"m5.1 8-2.9-.8",
		"m6 12-1.9 2",
		"M7.2 2.2 8 5.1",
		"M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z",
	],
	"layout-template": ["M3 3h18v7H3z", "M3 14h9v7H3z", "M16 14h5v7h-5z"],
	menu: ["M4 12h16", "M4 6h16", "M4 18h16"],
	"panel-bottom": ["M3 3h18v18H3z", "M3 15h18"],
	"locate-fixed": ["M2 12h3", "M19 12h3", "M12 2v3", "M12 19v3", "M12 5a7 7 0 1 0 0 14a7 7 0 1 0 0-14", "M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6"],
	// work queue: the area of a to-do item
	"arrow-left": ["m12 19-7-7 7-7", "M19 12H5"],
	"chevron-up": ["m18 15-6-6-6 6"],
	"shopping-cart": ["M7 21a1 1 0 1 0 2 0a1 1 0 1 0-2 0", "M18 21a1 1 0 1 0 2 0a1 1 0 1 0-2 0", "M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"],
	receipt: ["M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z", "M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8", "M12 17.5v-11"],
	"package-x": [
		"M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14",
		"m7.5 4.27 9 5.15",
		"M3.29 7 12 12l8.71-5",
		"M12 22V12",
		"m17 13 5 5m-5 0 5-5",
	],
	"link-2-off": ["M9 17H7A5 5 0 0 1 7 7", "M15 7h2a5 5 0 0 1 4 8", "M8 12h4", "m2 2 20 20"],
	percent: ["M19 5 5 19", "M4 6.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0", "M15 17.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0"],
	mail: ["M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"],
	globe: ["M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0Z", "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20", "M2 12h20"],
	"message-square": ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
	"list-todo": ["M4 5h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z", "m3 17 2 2 4-4", "M13 6h8", "M13 12h8", "M13 18h8"],
	"shopping-bag": ["M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z", "M3 6h18", "M16 10a4 4 0 0 1-8 0"],
	history: ["M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", "M3 3v5h5", "M12 7v5l4 2"],
	users: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M13 7a4 4 0 1 1-8 0a4 4 0 0 1 8 0z", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
	warehouse: ["M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z", "M6 18h12", "M6 14h12", "M6 10h12v12H6z"],
	"user-plus": ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M13 7a4 4 0 1 1-8 0a4 4 0 0 1 8 0z", "M19 8v6", "M22 11h-6"],
} as const;

export type IconName = keyof typeof PATHS;

/** A name from data (a to-do item's area icon) as a drawable icon: unknown names fall back. */
export const iconOr = (name: string, fallback: IconName): IconName => (name in PATHS ? (name as IconName) : fallback);

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
	name: IconName;
	size?: number;
}

export function Icon({ name, size = 16, className, ...rest }: IconProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			className={`ech-ag-icon lucide lucide-${name}${className ? ` ${className}` : ""}`}
			{...rest}
		>
			{name === "bot" && <rect width="16" height="12" x="4" y="8" rx="2" />}
			{name === "ellipsis" && (
				<>
					<circle cx="12" cy="12" r="1" />
					<circle cx="19" cy="12" r="1" />
					<circle cx="5" cy="12" r="1" />
				</>
			)}
			{PATHS[name].map((d) => (
				<path key={d} d={d} />
			))}
		</svg>
	);
}
