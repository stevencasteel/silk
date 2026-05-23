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
    { minX: -15, maxX: -14, minY: 0, maxY: 30, minZ: -2, maxZ: 2 },
    { minX: 14, maxX: 15, minY: 0, maxY: 30, minZ: -2, maxZ: 2 },
    { minX: -15, maxX: 15, minY: 0, maxY: 1, minZ: -2, maxZ: 2 },
    { minX: -15, maxX: 15, minY: 28, maxY: 30, minZ: -2, maxZ: 2 }
];
