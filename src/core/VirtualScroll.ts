// ============================================
// VirtualScroll - Core Virtualization Engine
// High-performance scrolling for 100k+ rows
// ============================================

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

export class VirtualScroll {
  private config: VirtualScrollConfig;
  private lastComputedResult: VirtualScrollResult | null = null;

  constructor(config: Partial<VirtualScrollConfig> = {}) {
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
  setConfig(config: Partial<VirtualScrollConfig>): void {
    this.config = { ...this.config, ...config };
    this.lastComputedResult = null; // Invalidate cache
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<VirtualScrollConfig> {
    return { ...this.config };
  }

  /**
   * Calculate visible items based on scroll position
   * Uses O(1) math instead of O(n) iteration
   */
  compute(): VirtualScrollResult {
    const { itemCount, itemHeight, bufferSize, containerHeight, scrollTop } = this.config;

    if (itemCount === 0 || itemHeight === 0 || containerHeight === 0) {
      const emptyResult: VirtualScrollResult = {
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

    const result: VirtualScrollResult = {
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
  getLastResult(): VirtualScrollResult | null {
    return this.lastComputedResult;
  }

  /**
   * Scroll to specific item index
   * Returns the scrollTop position
   */
  scrollToIndex(index: number): number {
    const { itemHeight } = this.config;
    return Math.max(0, index * itemHeight);
  }

  /**
   * Get item index from scroll position
   */
  getIndexFromScroll(scrollTop: number): number {
    const { itemHeight } = this.config;
    return Math.floor(scrollTop / itemHeight);
  }

  /**
   * Check if item at index is visible
   */
  isItemVisible(index: number): boolean {
    if (!this.lastComputedResult) {
      this.compute();
    }
    const { startIndex, endIndex } = this.lastComputedResult!.visibleItems;
    return index >= startIndex && index <= endIndex;
  }

  /**
   * Handle scroll event and return new scroll position
   * This uses rAF for smooth scrolling
   */
  handleScroll(scrollTop: number, maxScrollTop: number): ScrollPosition {
    // Clamp scroll position
    const clampedScrollTop = Math.max(0, Math.min(scrollTop, maxScrollTop));
    return { scrollTop: clampedScrollTop, scrollLeft: 0 };
  }

  /**
   * Get scroll range (max scroll top)
   */
  getScrollRange(): number {
    const { itemCount, itemHeight, containerHeight } = this.config;
    return Math.max(0, itemCount * itemHeight - containerHeight);
  }

  /**
   * Create range array for visible items
   * Returns indices of visible items
   */
  getVisibleRange(): number[] {
    const result = this.compute();
    const { startIndex, endIndex } = result.visibleItems;
    const range: number[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      range.push(i);
    }
    return range;
  }
}

export default VirtualScroll;
