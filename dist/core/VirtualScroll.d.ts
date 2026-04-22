import { ViewportInfo, ScrollPosition } from '../types/grid';
export interface VirtualScrollConfig {
    /** Total number of items */
    itemCount: number;
    /** Item height in pixels (default: 48) */
    itemHeight: number;
    /** Number of buffer items above/below viewport */
    bufferSize: number;
    /** Container height */
    containerHeight: number;
    /** Scroll top position */
    scrollTop: number;
}
export interface VirtualScrollResult {
    /** Indices of visible items */
    visibleItems: {
        startIndex: number;
        endIndex: number;
    };
    /** Total scrollable height */
    totalHeight: number;
    /** Offset to apply to translateY */
    offsetY: number;
    /** Viewport information */
    viewport: ViewportInfo;
}
export declare class VirtualScroll {
    private config;
    private lastComputedResult;
    constructor(config?: Partial<VirtualScrollConfig>);
    /**
     * Update configuration
     */
    setConfig(config: Partial<VirtualScrollConfig>): void;
    /**
     * Get current configuration
     */
    getConfig(): Readonly<VirtualScrollConfig>;
    /**
     * Calculate visible items based on scroll position
     * Uses O(1) math instead of O(n) iteration
     */
    compute(): VirtualScrollResult;
    /**
     * Get last computed result (cached)
     */
    getLastResult(): VirtualScrollResult | null;
    /**
     * Scroll to specific item index
     * Returns the scrollTop position
     */
    scrollToIndex(index: number): number;
    /**
     * Get item index from scroll position
     */
    getIndexFromScroll(scrollTop: number): number;
    /**
     * Check if item at index is visible
     */
    isItemVisible(index: number): boolean;
    /**
     * Handle scroll event and return new scroll position
     * This uses rAF for smooth scrolling
     */
    handleScroll(scrollTop: number, maxScrollTop: number): ScrollPosition;
    /**
     * Get scroll range (max scroll top)
     */
    getScrollRange(): number;
    /**
     * Create range array for visible items
     * Returns indices of visible items
     */
    getVisibleRange(): number[];
}
export default VirtualScroll;
//# sourceMappingURL=VirtualScroll.d.ts.map