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
import { ColumnManager } from './ColumnManager';

export class DataGrid implements DataGridInstance {
  private container: HTMLElement | null = null;
  private virtualScroll: VirtualScroll;
  private dataManager: DataManager;
  private columnManager: ColumnManager;
  private config: Required<GridConfig>;
  private events: GridEvents;
  private scrollHandler: ((e: Event) => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private isDestroyed: boolean = false;

  // Column resize tracking
  private resizeStartX: number = 0;

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

    this.columnManager = new ColumnManager();

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

  canUndo(): boolean { return this.dataManager.canUndo(); }
  canRedo(): boolean { return this.dataManager.canRedo(); }
  undo(): boolean {
    const result = this.dataManager.undo();
    if (result) { this.updateVirtualScroll(); this.render(); }
    return result;
  }
  redo(): boolean {
    const result = this.dataManager.redo();
    if (result) { this.updateVirtualScroll(); this.render(); }
    return result;
  }

  // ============================================
  // Public API - Selection
  // ============================================

  getSelectedRows(): RowData[] { return []; }
  clearSelection(): void {}

  // ============================================
  // Public API - Sorting & Filtering
  // ============================================

  getSortState(): SortState[] { return this.dataManager.getSortState(); }
  setSortState(state: SortState[]): void {
    this.dataManager.setSortState(state);
    this.events.onSort?.(state);
    this.render();
  }

  getFilterState(): FilterState[] { return this.dataManager.getFilterState(); }
  setFilterState(state: FilterState[]): void {
    this.dataManager.setFilterState(state);
    this.events.onFilter?.(state);
    this.updateVirtualScroll();
    this.render();
  }

  // ============================================
  // Public API - Columns
  // ============================================

  setColumns(columns: ColumnDefinition[]): void {
    this.columnManager = new ColumnManager(columns);
    this.render();
  }

  getColumn(columnId: string): ColumnDefinition | undefined {
    return this.columnManager.getColumn(columnId);
  }

  updateColumn(columnId: string, updates: Partial<ColumnDefinition>): void {
    this.columnManager.updateColumn(columnId, updates);
    this.render();
  }

  setColumnWidth(columnId: string, width: number): void {
    this.columnManager.setColumnWidth(columnId, width);
    this.render();
  }

  pinColumnLeft(columnId: string): void {
    this.columnManager.pinColumnLeft(columnId);
    this.render();
  }

  pinColumnRight(columnId: string): void {
    this.columnManager.pinColumnRight(columnId);
    this.render();
  }

  unpinColumn(columnId: string): void {
    this.columnManager.unpinColumn(columnId);
    this.render();
  }

  toggleColumnPin(columnId: string): void {
    this.columnManager.toggleColumnPin(columnId);
    this.render();
  }

  toggleColumnVisibility(columnId: string): void {
    this.columnManager.toggleColumnVisibility(columnId);
    this.render();
  }

  moveColumn(fromIndex: number, toIndex: number): void {
    this.columnManager.moveColumn(fromIndex, toIndex);
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

  getViewportInfo(): ViewportInfo {
    return this.virtualScroll.compute().viewport;
  }

  // ============================================
  // Public API - Export
  // ============================================

  exportToCSV(): string {
    const data = this.getData();
    const columns = this.columnManager.getVisibleColumns();
    const headers = columns.map(c => c.header);
    const rows = data.map(row => 
      columns.map(col => {
        const value = row[col.field];
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
  // Private Methods
  // ============================================

  private setupContainer(): void {
    if (!this.container) return;
    this.container.style.overflow = 'auto';
    this.container.style.position = 'relative';
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
    const columns = this.columnManager.getColumnsInOrder();
    void columns; // Used in loop below

    let html = '';
    
    // Header with resize handles
    html += `<div class="dg-header" style="height: ${this.config.headerHeight}px; display: flex;">`;
    for (const col of columns) {
      if (!this.columnManager.isColumnVisible(col.id)) continue;
      const width = this.columnManager.getColumnWidth(col.id);
      const pinClass = this.columnManager.getColumnPin(col.id) === 'left' ? ' dg-pin-left' : 
                       this.columnManager.getColumnPin(col.id) === 'right' ? ' dg-pin-right' : '';
      html += `<div class="dg-header-cell${pinClass}" data-column-id="${col.id}" style="width: ${width}px; min-width: ${col.minWidth || 50}px;">
        <span class="dg-header-text">${col.header}</span>
        ${col.sortable !== false ? '<span class="dg-sort-icon"></span>' : ''}
      </div>`;
      // Resize handle
      html += `<div class="dg-resize-handle" data-resize-column="${col.id}"></div>`;
    }
    html += '</div>';

    // Body with virtual scroll
    const bodyHeight = this.dataManager.getRowCount() * this.config.rowHeight;
    html += `<div class="dg-body" style="height: ${bodyHeight}px; position: relative;">`;
    
    for (let i = visibleRange.startIndex; i <= visibleRange.endIndex; i++) {
      if (i < 0 || i >= data.length) continue;
      const row = data[i];
      const rowId = this.dataManager.getRowId(row);
      const offsetY = i * this.config.rowHeight;
      
      html += `<div class="dg-row" data-row-id="${rowId}" style="position: absolute; top: ${offsetY}px; height: ${this.config.rowHeight}px; display: flex; width: 100%;">`;
      
      for (const col of columns) {
        if (!this.columnManager.isColumnVisible(col.id)) continue;
        const width = this.columnManager.getColumnWidth(col.id);
        const value = row[col.field];
        const displayValue = value === null || value === undefined ? '' : String(value);
        html += `<div class="dg-cell" data-column-id="${col.id}" style="width: ${width}px; min-width: ${col.minWidth || 50}px;">
          ${col.renderCell ? col.renderCell(value, row, i) : displayValue}
        </div>`;
      }
      
      html += '</div>';
    }
    html += '</div>';

    this.injectStyles();
    this.injectEventHandlers();
    this.container.innerHTML = html;
  }

  private injectStyles(): void {
    if (document.getElementById('datagrid-styles-v3')) return;
    const style = document.createElement('style');
    style.id = 'datagrid-styles-v3';
    style.textContent = `
      .dg-header {
        background: #f8f9fa;
        border-bottom: 2px solid #dee2e6;
        position: sticky;
        top: 0;
        z-index: 2;
        user-select: none;
      }
      .dg-header-cell {
        padding: 0 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-weight: 600;
        color: #495057;
        font-size: 14px;
        border-right: 1px solid #e9ecef;
        cursor: pointer;
        position: relative;
        flex-shrink: 0;
      }
      .dg-header-cell:hover { background: #e9ecef; }
      .dg-header-cell.dg-pin-left { position: sticky; left: 0; z-index: 3; background: #f8f9fa; }
      .dg-header-cell.dg-pin-right { position: sticky; right: 0; z-index: 3; background: #f8f9fa; }
      .dg-header-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dg-sort-icon { width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 5px solid #adb5bd; margin-left: 8px; }
      .dg-resize-handle {
        position: absolute;
        right: 0;
        top: 0;
        bottom: 0;
        width: 6px;
        cursor: col-resize;
        z-index: 4;
        background: transparent;
      }
      .dg-resize-handle:hover { background: rgba(108, 92, 231, 0.3); }
      .dg-resize-handle.dg-resizing { background: #6c5ce7; }
      .dg-body { overflow: hidden; }
      .dg-row { border-bottom: 1px solid #f1f3f5; }
      .dg-row:hover { background: #f8f9fa; }
      .dg-cell {
        padding: 0 12px;
        display: flex;
        align-items: center;
        font-size: 14px;
        color: #212529;
        border-right: 1px solid #f0f0f0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex-shrink: 0;
      }
    `;
    document.head.appendChild(style);
  }

  private injectEventHandlers(): void {
    if (!this.container) return;

    // Resize handles
    const resizeHandles = this.container.querySelectorAll('.dg-resize-handle');
    resizeHandles.forEach(handle => {
      const colId = (handle as HTMLElement).dataset.resizeColumn;
      if (!colId) return;

      let isResizing = false;

      const onMouseMove = (e: MouseEvent) => {
        if (!isResizing) return;
        const deltaX = e.clientX - this.resizeStartX;
        const currentWidth = this.columnManager.getColumnWidth(colId);
        this.columnManager.setColumnWidth(colId, currentWidth + deltaX);
        this.resizeStartX = e.clientX;
        this.render();
      };

      const onMouseUp = () => {
        isResizing = false;
        handle.classList.remove('dg-resizing');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      handle.addEventListener('mousedown', (e: Event) => {
        isResizing = true;
        this.resizeStartX = (e as MouseEvent).clientX;
        handle.classList.add('dg-resizing');
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    });

    // Header click for sort
    const headerCells = this.container.querySelectorAll('.dg-header-cell');
    headerCells.forEach(cell => {
      const colId = (cell as HTMLElement).dataset.columnId;
      if (!colId) return;

      cell.addEventListener('click', () => {
        const col = this.columnManager.getColumn(colId);
        if (!col || col.sortable === false) return;

        const currentSort = this.dataManager.getSortState();
        const existing = currentSort.find(s => s.columnId === colId);

        if (!existing) {
          this.dataManager.addSortState(colId, 'asc');
        } else if (existing.direction === 'asc') {
          this.dataManager.addSortState(colId, 'desc');
        } else {
          this.dataManager.clearSortState();
        }
        this.events.onSort?.(this.dataManager.getSortState());
        this.render();
      });
    });

    // Row click
    const rows = this.container.querySelectorAll('.dg-row');
    rows.forEach(row => {
      row.addEventListener('click', () => {
        const rowId = (row as HTMLElement).dataset.rowId;
        if (!rowId) return;
        const rowData = this.dataManager.getRowById(rowId);
        if (rowData) this.events.onRowClick?.(rowId, rowData);
      });
    });
  }
}

export default DataGrid;
