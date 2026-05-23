export interface AABB {
    minX: number; maxX: number;
    minY: number; maxY: number;
    minZ: number; maxZ: number;
}
export const PLATFORM_AABBS: AABB[] = [
    { minX: -15.0, maxX: -7.0, minY: 11.5, maxY: 12.5, minZ: -2, maxZ: 2 },
    { minX: 7.0, maxX: 15.0, minY: 17.5, maxY: 18.5, minZ: -2, maxZ: 2 }
];
export const BORDER_AABBS: AABB[] = [
    { minX: -17.0, maxX: -15.0, minY: 0.0, maxY: 28.0, minZ: -2, maxZ: 2 }, // Left Wall (visual inner edge -15)
    { minX: 15.0, maxX: 17.0, minY: 0.0, maxY: 28.0, minZ: -2, maxZ: 2 },  // Right Wall (visual inner edge 15)
    { minX: -17.0, maxX: 17.0, minY: -2.0, maxY: 0.0, minZ: -2, maxZ: 2 },  // Floor (visual inner edge 0)
    { minX: -17.0, maxX: 17.0, minY: 28.0, maxY: 30.0, minZ: -2, maxZ: 2 }  // Ceiling (visual inner edge 28)
];
