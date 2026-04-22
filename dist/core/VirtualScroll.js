// ============================================
// VirtualScroll - Core Virtualization Engine
// High-performance scrolling for 100k+ rows
// ============================================
export class VirtualScroll {
    constructor(config = {}) {
        this.lastComputedResult = null;
        this.config = {
            itemCount: 0,
            itemHeight: 48,
            bufferSize: 5,
            containerHeight: 600,
            scrollTop: 0,
            ...config,
        };
    }
    /**
     * Update configuration
     */
    setConfig(config) {
        this.config = { ...this.config, ...config };
        this.lastComputedResult = null; // Invalidate cache
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Calculate visible items based on scroll position
     * Uses O(1) math instead of O(n) iteration
     */
    compute() {
        const { itemCount, itemHeight, bufferSize, containerHeight, scrollTop } = this.config;
        if (itemCount === 0 || itemHeight === 0 || containerHeight === 0) {
            const emptyResult = {
                visibleItems: { startIndex: 0, endIndex: 0 },
                totalHeight: 0,
                offsetY: 0,
                viewport: {
                    visibleStartIndex: 0,
                    visibleEndIndex: 0,
                    visibleCount: 0,
                    offsetY: 0,
                    offsetX: 0,
                },
            };
            this.lastComputedResult = emptyResult;
            return emptyResult;
        }
        // Total height of all items
        const totalHeight = itemCount * itemHeight;
        // Calculate visible range using math (O(1))
        // First visible item index
        const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferSize);
        // How many items fit in the viewport
        const visibleCount = Math.ceil(containerHeight / itemHeight);
        // Last visible item index (with buffer)
        const endIndex = Math.min(itemCount - 1, Math.ceil(scrollTop / itemHeight) + visibleCount + bufferSize);
        // Offset for positioning the visible items
        const offsetY = startIndex * itemHeight;
        const result = {
            visibleItems: { startIndex, endIndex },
            totalHeight,
            offsetY,
            viewport: {
                visibleStartIndex: startIndex,
                visibleEndIndex: endIndex,
                visibleCount: endIndex - startIndex + 1,
                offsetY,
                offsetX: 0,
            },
        };
        this.lastComputedResult = result;
        return result;
    }
    /**
     * Get last computed result (cached)
     */
    getLastResult() {
        return this.lastComputedResult;
    }
    /**
     * Scroll to specific item index
     * Returns the scrollTop position
     */
    scrollToIndex(index) {
        const { itemHeight } = this.config;
        return Math.max(0, index * itemHeight);
    }
    /**
     * Get item index from scroll position
     */
    getIndexFromScroll(scrollTop) {
        const { itemHeight } = this.config;
        return Math.floor(scrollTop / itemHeight);
    }
    /**
     * Check if item at index is visible
     */
    isItemVisible(index) {
        if (!this.lastComputedResult) {
            this.compute();
        }
        const { startIndex, endIndex } = this.lastComputedResult.visibleItems;
        return index >= startIndex && index <= endIndex;
    }
    /**
     * Handle scroll event and return new scroll position
     * This uses rAF for smooth scrolling
     */
    handleScroll(scrollTop, maxScrollTop) {
        // Clamp scroll position
        const clampedScrollTop = Math.max(0, Math.min(scrollTop, maxScrollTop));
        return { scrollTop: clampedScrollTop, scrollLeft: 0 };
    }
    /**
     * Get scroll range (max scroll top)
     */
    getScrollRange() {
        const { itemCount, itemHeight, containerHeight } = this.config;
        return Math.max(0, itemCount * itemHeight - containerHeight);
    }
    /**
     * Create range array for visible items
     * Returns indices of visible items
     */
    getVisibleRange() {
        const result = this.compute();
        const { startIndex, endIndex } = result.visibleItems;
        const range = [];
        for (let i = startIndex; i <= endIndex; i++) {
            range.push(i);
        }
        return range;
    }
}
export default VirtualScroll;
//# sourceMappingURL=VirtualScroll.js.map