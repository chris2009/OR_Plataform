export interface CocoClass {
  id: number;
  name: string;
  category: string;
}

export const COCO_CLASSES: CocoClass[] = [
  // Personas
  { id: 0, name: "person", category: "Personas" },
  // Vehículos
  { id: 1, name: "bicycle", category: "Vehículos" },
  { id: 2, name: "car", category: "Vehículos" },
  { id: 3, name: "motorcycle", category: "Vehículos" },
  { id: 4, name: "airplane", category: "Vehículos" },
  { id: 5, name: "bus", category: "Vehículos" },
  { id: 6, name: "train", category: "Vehículos" },
  { id: 7, name: "truck", category: "Vehículos" },
  { id: 8, name: "boat", category: "Vehículos" },
  // Animales
  { id: 14, name: "bird", category: "Animales" },
  { id: 15, name: "cat", category: "Animales" },
  { id: 16, name: "dog", category: "Animales" },
  { id: 17, name: "horse", category: "Animales" },
  { id: 18, name: "sheep", category: "Animales" },
  { id: 19, name: "cow", category: "Animales" },
  { id: 20, name: "elephant", category: "Animales" },
  { id: 21, name: "bear", category: "Animales" },
  { id: 22, name: "zebra", category: "Animales" },
  { id: 23, name: "giraffe", category: "Animales" },
  // Electrónica
  { id: 62, name: "tv", category: "Electrónica" },
  { id: 63, name: "laptop", category: "Electrónica" },
  { id: 64, name: "mouse", category: "Electrónica" },
  { id: 65, name: "remote", category: "Electrónica" },
  { id: 66, name: "keyboard", category: "Electrónica" },
  { id: 67, name: "cell phone", category: "Electrónica" },
  // Muebles
  { id: 56, name: "chair", category: "Muebles" },
  { id: 57, name: "couch", category: "Muebles" },
  { id: 58, name: "potted plant", category: "Muebles" },
  { id: 59, name: "bed", category: "Muebles" },
  { id: 60, name: "dining table", category: "Muebles" },
  { id: 61, name: "toilet", category: "Muebles" },
  // Cocina
  { id: 68, name: "microwave", category: "Cocina" },
  { id: 69, name: "oven", category: "Cocina" },
  { id: 70, name: "toaster", category: "Cocina" },
  { id: 71, name: "sink", category: "Cocina" },
  { id: 72, name: "refrigerator", category: "Cocina" },
  // Objetos cotidianos
  { id: 24, name: "backpack", category: "Objetos" },
  { id: 25, name: "umbrella", category: "Objetos" },
  { id: 26, name: "handbag", category: "Objetos" },
  { id: 27, name: "tie", category: "Objetos" },
  { id: 28, name: "suitcase", category: "Objetos" },
  { id: 39, name: "bottle", category: "Objetos" },
  { id: 41, name: "cup", category: "Objetos" },
  { id: 73, name: "book", category: "Objetos" },
  { id: 74, name: "clock", category: "Objetos" },
  { id: 75, name: "vase", category: "Objetos" },
  { id: 76, name: "scissors", category: "Objetos" },
  { id: 77, name: "teddy bear", category: "Objetos" },
  { id: 78, name: "hair drier", category: "Objetos" },
  { id: 79, name: "toothbrush", category: "Objetos" },
];

export const COCO_BY_CATEGORY = COCO_CLASSES.reduce<Record<string, CocoClass[]>>((acc, cls) => {
  if (!acc[cls.category]) acc[cls.category] = [];
  acc[cls.category].push(cls);
  return acc;
}, {});
