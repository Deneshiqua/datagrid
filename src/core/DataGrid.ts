// ============================================
// DataGrid - Main Entry Point
// High-performance JavaScript Data Grid
// ============================================

import { 
  DataGridInstance, 
  DataGridOptions, 
  RowData, 
  ColumnDefinition,
  GridConfig,
  GridEvents,
  ScrollPosition,
  SortState,
  FilterState,
  ViewportInfo,
} from '../types/grid';
import { VirtualScroll } from './VirtualScroll';
import { DataManager } from './DataManager';

export class DataGrid implements DataGridInstance {
  private container: HTMLElement | null = null;
  private virtualScroll: VirtualScroll;
  private dataManager: DataManager;
  private columns: Map<string, ColumnDefinition> = new Map();
  private columnOrder: string[] = [];
  private config: Required<GridConfig>;
  private events: GridEvents;
  private scrollHandler: ((e: Event) => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private isDestroyed: boolean = false;

  constructor(container: HTMLElement, options: DataGridOptions = {}) {
    this.container = container;
    
    // Default configuration
    this.config = {
      rowHeight: options.rowHeight ?? 48,
      headerHeight: options.headerHeight ?? 56,
      bufferSize: options.bufferSize ?? 5,
      autoHeight: options.autoHeight ?? false,
      selection: options.selection ?? { mode: 'none' },
      sorting: options.sorting ?? { multiSort: false },
      filtering: options.filtering ?? { enabled: true, quickFilter: false },
      editing: options.editing ?? { enabled: false, mode: 'cell' },
      pagination: options.pagination ?? { enabled: false, pageSize: 100, pageSizes: [25, 50, 100, 500] },
    };

    // Events
    this.events = {
      onScroll: options.onScroll,
      onSort: options.onSort,
      onFilter: options.onFilter,
      onSelect: options.onSelect,
      onEdit: options.onEdit,
      onCellEditStart: options.onCellEditStart,
      onCellEditEnd: options.onCellEditEnd,
      onRowClick: options.onRowClick,
      onRowDoubleClick: options.onRowDoubleClick,
    };

    // Initialize managers
    this.virtualScroll = new VirtualScroll({
      itemHeight: this.config.rowHeight,
      bufferSize: this.config.bufferSize,
      itemCount: 0,
      containerHeight: 0,
      scrollTop: 0,
    });

    this.dataManager = new DataManager({
      idField: 'id',
      sortable: true,
      filterable: this.config.filtering.enabled,
    });

    this.setupContainer();
    this.setupScrollHandling();
    this.setupResizeObserver();
  }

  // ============================================
  // Public API - Data
  // ============================================

  getData(): RowData[] {
    return this.dataManager.getData();
  }

  setData(data: RowData[]): void {
    this.dataManager.setData(data);
    this.updateVirtualScroll();
    this.render();
  }

  getRow(rowId: string): RowData | null {
    return this.dataManager.getRowById(rowId);
  }

  insertRow(index: number, row: RowData): void {
    this.dataManager.insertRow(index, row);
    this.updateVirtualScroll();
    this.render();
  }

  deleteRow(rowId: string): void {
    this.dataManager.deleteRow(rowId);
    this.updateVirtualScroll();
    this.render();
  }

  updateRow(rowId: string, data: Partial<RowData>): void {
    this.dataManager.updateRow(rowId, data);
    this.render();
  }

  batch(operations: any[]): void {
    this.dataManager.batch(operations);
    this.updateVirtualScroll();
    this.render();
  }

  canUndo(): boolean {
    return this.dataManager.canUndo();
  }

  canRedo(): boolean {
    return this.dataManager.canRedo();
  }

  undo(): boolean {
    const result = this.dataManager.undo();
    if (result) {
      this.updateVirtualScroll();
      this.render();
    }
    return result;
  }

  redo(): boolean {
    const result = this.dataManager.redo();
    if (result) {
      this.updateVirtualScroll();
      this.render();
    }
    return result;
  }

  // ============================================
  // Public API - Selection
  // ============================================

  getSelectedRows(): RowData[] {
    // TODO: Implement selection tracking
    return [];
  }

  clearSelection(): void {
    // TODO: Implement selection clearing
  }

  // ============================================
  // Public API - Sorting & Filtering
  // ============================================

  getSortState(): SortState[] {
    return this.dataManager.getSortState();
  }

  setSortState(state: SortState[]): void {
    this.dataManager.setSortState(state);
    this.events.onSort?.(state);
    this.render();
  }

  getFilterState(): FilterState[] {
    return this.dataManager.getFilterState();
  }

  setFilterState(state: FilterState[]): void {
    this.dataManager.setFilterState(state);
    this.events.onFilter?.(state);
    this.updateVirtualScroll();
    this.render();
  }

  // ============================================
  // Public API - Scroll
  // ============================================

  refresh(): void {
    this.updateVirtualScroll();
    this.render();
  }

  scrollToRow(rowId: string): void {
    const data = this.getData();
    const index = data.findIndex(row => this.dataManager.getRowId(row) === rowId);
    if (index >= 0) {
      const scrollTop = this.virtualScroll.scrollToIndex(index);
      this.setScrollPosition({ scrollTop, scrollLeft: 0 });
    }
  }

  getScrollPosition(): ScrollPosition {
    return {
      scrollTop: this.virtualScroll.getConfig().scrollTop,
      scrollLeft: 0,
    };
  }

  setScrollPosition(position: ScrollPosition): void {
    const maxScrollTop = this.virtualScroll.getScrollRange();
    
    const newScrollTop = Math.max(0, Math.min(position.scrollTop, maxScrollTop));
    
    this.virtualScroll.setConfig({ scrollTop: newScrollTop });
    this.render();
    this.events.onScroll?.(position);
  }

  // ============================================
  // Public API - Export
  // ============================================

  exportToCSV(): string {
    const data = this.getData();
    const headers = this.columnOrder.map(id => this.columns.get(id)?.header || id);
    const rows = data.map(row => 
      this.columnOrder.map(id => {
        const value = row[id];
        // Escape quotes and wrap in quotes if contains comma
        const strValue = value === null || value === undefined ? '' : String(value);
        return strValue.includes(',') ? `"${strValue.replace(/"/g, '""')}"` : strValue;
      }).join(',')
    );
    return [headers.join(','), ...rows].join('\n');
  }

  // ============================================
  // Public API - Lifecycle
  // ============================================

  destroy(): void {
    this.isDestroyed = true;
    
    if (this.scrollHandler && this.container) {
      this.container.removeEventListener('scroll', this.scrollHandler);
    }
    
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    
    this.container = null;
  }

  // ============================================
  // Column Management
  // ============================================

  setColumns(columns: ColumnDefinition[]): void {
    this.columns.clear();
    this.columnOrder = [];
    
    for (const col of columns) {
      this.columns.set(col.id, col);
      this.columnOrder.push(col.id);
    }
    
    this.render();
  }

  getColumn(columnId: string): ColumnDefinition | undefined {
    return this.columns.get(columnId);
  }

  updateColumn(columnId: string, updates: Partial<ColumnDefinition>): void {
    const col = this.columns.get(columnId);
    if (col) {
      this.columns.set(columnId, { ...col, ...updates });
      this.render();
    }
  }

  // ============================================
  // Viewport Info
  // ============================================

  getViewportInfo(): ViewportInfo {
    const result = this.virtualScroll.compute();
    return result.viewport;
  }

  // ============================================
  // Private Methods
  // ============================================

  private setupContainer(): void {
    if (!this.container) return;
    
    // Set container styles
    this.container.style.overflow = 'auto';
    this.container.style.position = 'relative';
    
    // Initial measurement
    const rect = this.container.getBoundingClientRect();
    this.virtualScroll.setConfig({
      containerHeight: rect.height - this.config.headerHeight,
    });
  }

  private setupScrollHandling(): void {
    if (!this.container) return;

    let ticking = false;
    
    this.scrollHandler = (_e: Event) => {
      if (!ticking) {
        requestAnimationFrame(() => {
          if (this.container && !this.isDestroyed) {
            const scrollTop = this.container.scrollTop;
            const scrollLeft = this.container.scrollLeft;
            
            this.virtualScroll.setConfig({ scrollTop });
            this.render();
            
            this.events.onScroll?.({ scrollTop, scrollLeft });
          }
          ticking = false;
        });
        ticking = true;
      }
    };
    
    this.container.addEventListener('scroll', this.scrollHandler);
  }

  private setupResizeObserver(): void {
    if (!this.container) return;

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { height } = entry.contentRect;
        this.virtualScroll.setConfig({
          containerHeight: height - this.config.headerHeight,
        });
        this.updateVirtualScroll();
        this.render();
      }
    });

    this.resizeObserver.observe(this.container);
  }

  private updateVirtualScroll(): void {
    const containerHeight = this.container?.clientHeight 
      ? this.container.clientHeight - this.config.headerHeight 
      : 600;
    
    this.virtualScroll.setConfig({
      itemCount: this.dataManager.getRowCount(),
      itemHeight: this.config.rowHeight,
      containerHeight,
    });
  }

  private render(): void {
    if (!this.container || this.isDestroyed) return;

    const result = this.virtualScroll.compute();
    const data = this.getData();
    const visibleRange = result.visibleItems;

    // Build HTML
    let html = '';
    
    // Header
    html += `<div class="dg-header" style="height: ${this.config.headerHeight}px; display: flex;">`;
    for (const colId of this.columnOrder) {
      const col = this.columns.get(colId);
      if (!col || col.visible === false) continue;
      html += `<div class="dg-header-cell" style="width: ${col.width || 100}px; min-width: ${col.minWidth || 50}px;">
        ${col.header}
      </div>`;
    }
    html += '</div>';

    // Body with virtual scroll
    const bodyHeight = this.dataManager.getRowCount() * this.config.rowHeight;
    html += `<div class="dg-body" style="height: ${bodyHeight}px; position: relative;">`;
    
    // Visible rows only
    for (let i = visibleRange.startIndex; i <= visibleRange.endIndex; i++) {
      if (i < 0 || i >= data.length) continue;
      
      const row = data[i];
      const rowId = this.dataManager.getRowId(row);
      const offsetY = i * this.config.rowHeight;
      
      html += `<div class="dg-row" data-row-id="${rowId}" style="position: absolute; top: ${offsetY}px; height: ${this.config.rowHeight}px; display: flex; width: 100%;">`;
      
      for (const colId of this.columnOrder) {
        const col = this.columns.get(colId);
        if (!col || col.visible === false) continue;
        
        const value = row[col.field];
        html += `<div class="dg-cell" data-column-id="${colId}" style="width: ${col.width || 100}px; min-width: ${col.minWidth || 50}px;">
          ${col.renderCell ? col.renderCell(value, row, i) : value}
        </div>`;
      }
      
      html += '</div>';
    }
    
    html += '</div>';

    // Apply basic styles if not already
    this.injectStyles();

    // Set innerHTML
    this.container.innerHTML = html;
  }

  private injectStyles(): void {
    if (document.getElementById('datagrid-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'datagrid-styles';
    style.textContent = `
      .dg-header {
        background: #f5f5f5;
        border-bottom: 1px solid #ddd;
        position: sticky;
        top: 0;
        z-index: 1;
      }
      .dg-header-cell {
        padding: 0 12px;
        display: flex;
        align-items: center;
        font-weight: 600;
        font-size: 14px;
        border-right: 1px solid #eee;
        user-select: none;
      }
      .dg-body {
        overflow: hidden;
      }
      .dg-row {
        border-bottom: 1px solid #eee;
      }
      .dg-row:hover {
        background: #fafafa;
      }
      .dg-cell {
        padding: 0 12px;
        display: flex;
        align-items: center;
        font-size: 14px;
        border-right: 1px solid #f0f0f0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `;
    document.head.appendChild(style);
  }
}

export default DataGrid;
