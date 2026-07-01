import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { COCO_CLASSES } from "./cocoClasses";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const classIdByName = new Map(COCO_CLASSES.map((c) => [c.name, c.id]));

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return [
    Math.round((rgb[0] + m) * 255),
    Math.round((rgb[1] + m) * 255),
    Math.round((rgb[2] + m) * 255),
  ];
}

function hashClassName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 1000;
  return h;
}

/**
 * Color determinístico por clase COCO, replicando el mismo algoritmo
 * HSV que usa el backend para dibujar los bounding boxes (worker.py
 * `_color_for_class`), así el color de cada clase es consistente entre
 * el mosaico en vivo, los snapshots y los gráficos del dashboard.
 */
export function colorForClass(className: string): string {
  const id = classIdByName.get(className.toLowerCase()) ?? hashClassName(className);
  const hueDeg = ((id * 37) % 180) * 2;
  const [r, g, b] = hsvToRgb(hueDeg, 220 / 255, 1);
  return `rgb(${r}, ${g}, ${b})`;
}
