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
  private resizeStartX: number = 0;
  private filterPopup: HTMLElement | null = null;

  constructor(container: HTMLElement, options: DataGridOptions = {}) {
    this.container = container;

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

  getData(): RowData[] { return this.dataManager.getData(); }

  setData(data: RowData[]): void {
    this.dataManager.setData(data);
    this.updateVirtualScroll();
    this.render();
  }

  getRow(rowId: string): RowData | null { return this.dataManager.getRowById(rowId); }

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

  getSelectedRows(): RowData[] { return []; }
  clearSelection(): void {}

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

  pinColumnLeft(columnId: string): void { this.columnManager.pinColumnLeft(columnId); this.render(); }
  pinColumnRight(columnId: string): void { this.columnManager.pinColumnRight(columnId); this.render(); }
  unpinColumn(columnId: string): void { this.columnManager.unpinColumn(columnId); this.render(); }
  toggleColumnPin(columnId: string): void { this.columnManager.toggleColumnPin(columnId); this.render(); }
  toggleColumnVisibility(columnId: string): void { this.columnManager.toggleColumnVisibility(columnId); this.render(); }
  moveColumn(fromIndex: number, toIndex: number): void { this.columnManager.moveColumn(fromIndex, toIndex); this.render(); }

  // ============================================
  // Public API - Scroll
  // ============================================

  refresh(): void { this.updateVirtualScroll(); this.render(); }

  scrollToRow(rowId: string): void {
    const data = this.getData();
    const index = data.findIndex(row => this.dataManager.getRowId(row) === rowId);
    if (index >= 0) {
      const scrollTop = this.virtualScroll.scrollToIndex(index);
      this.setScrollPosition({ scrollTop, scrollLeft: 0 });
    }
  }

  getScrollPosition(): ScrollPosition {
    return { scrollTop: this.virtualScroll.getConfig().scrollTop, scrollLeft: 0 };
  }

  setScrollPosition(position: ScrollPosition): void {
    const maxScrollTop = this.virtualScroll.getScrollRange();
    const newScrollTop = Math.max(0, Math.min(position.scrollTop, maxScrollTop));
    this.virtualScroll.setConfig({ scrollTop: newScrollTop });
    this.render();
    this.events.onScroll?.(position);
  }

  getViewportInfo(): ViewportInfo { return this.virtualScroll.compute().viewport; }

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

  destroy(): void {
    this.isDestroyed = true;
    if (this.scrollHandler && this.container) this.container.removeEventListener('scroll', this.scrollHandler);
    if (this.resizeObserver) { this.resizeObserver.disconnect(); this.resizeObserver = null; }
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
    this.virtualScroll.setConfig({ containerHeight: rect.height - this.config.headerHeight });
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
        this.virtualScroll.setConfig({ containerHeight: height - this.config.headerHeight });
        this.updateVirtualScroll();
        this.render();
      }
    });
    this.resizeObserver.observe(this.container);
  }

  private updateVirtualScroll(): void {
    const containerHeight = this.container?.clientHeight ? this.container.clientHeight - this.config.headerHeight : 600;
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
    const sortStates = this.dataManager.getSortState();
    const filterStates = this.dataManager.getFilterState();

    let html = '';

    // Header
    html += `<div class="dg-header" style="height: ${this.config.headerHeight}px; display: flex; position: relative;">`;
    for (const col of columns) {
      if (!this.columnManager.isColumnVisible(col.id)) continue;
      const width = this.columnManager.getColumnWidth(col.id);
      const pinPos = this.columnManager.getColumnPin(col.id);
      const pinClass = pinPos === 'left' ? ' dg-pin-left' : pinPos === 'right' ? ' dg-pin-right' : '';

      // Sort state
      const sortIndex = sortStates.findIndex(s => s.columnId === col.id);
      let sortIcon = '';
      if (sortIndex !== -1) {
        const direction = sortStates[sortIndex].direction;
        if (sortStates.length > 1) {
          sortIcon = `<span class="dg-sort-badge">${sortIndex + 1}${direction === 'asc' ? ' ▲' : ' ▼'}</span>`;
        } else {
          sortIcon = `<span class="dg-sort-arrow">${direction === 'asc' ? '▲' : '▼'}</span>`;
        }
      }

      const hasFilter = this.config.filtering.enabled;
      const isFiltered = filterStates.some(f => f.columnId === col.id);
      html += `<div class="dg-header-cell${pinClass}" data-column-id="${col.id}" data-pinned="${pinPos || ''}" style="width: ${width}px; min-width: ${col.minWidth || 50}px;">
        <span class="dg-header-text">${col.header}${sortIcon}</span>
        ${hasFilter ? `<span class="dg-filter-icon${isFiltered ? ' active' : ''}" data-filter-column="${col.id}">🔍</span>` : ''}
        <div class="dg-resize-handle" data-resize-column="${col.id}"></div>
      </div>`;
    }
    html += '</div>';

    // Body
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
    this.container.innerHTML = html;
    this.injectEventHandlers();
  }

  private injectStyles(): void {
    if (document.getElementById('datagrid-styles-v5')) return;
    const style = document.createElement('style');
    style.id = 'datagrid-styles-v5';
    style.textContent = `
      .dg-header {
        background: #f8f9fa;
        border-bottom: 2px solid #dee2e6;
        display: flex;
        user-select: none;
      }
      .dg-header-cell {
        padding: 0 12px;
        display: flex;
        align-items: center;
        font-weight: 600;
        color: #495057;
        font-size: 14px;
        border-right: 1px solid #e9ecef;
        cursor: pointer;
        position: relative;
        flex-shrink: 0;
        overflow: visible;
      }
      .dg-header-cell:hover { background: #e9ecef; }
      .dg-header-cell.dg-pin-left { position: sticky; left: 0; z-index: 10; background: #e8f4f8; }
      .dg-header-cell.dg-pin-right { position: sticky; right: 0; z-index: 10; background: #fff9e6; }
      .dg-header-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: flex; align-items: center; gap: 6px; }
      .dg-sort-arrow { font-size: 10px; color: #6c5ce7; margin-left: 4px; }
      .dg-sort-badge { font-size: 10px; background: #6c5ce7; color: white; padding: 1px 5px; border-radius: 8px; margin-left: 4px; min-width: 18px; text-align: center; }
      .dg-filter-icon { cursor: pointer; padding: 2px 4px; border-radius: 4px; font-size: 12px; }
      .dg-filter-icon:hover { background: rgba(108,92,231,0.2); }
      .dg-filter-icon.active { color: #6c5ce7; font-weight: bold; }
      .dg-resize-handle {
        position: absolute;
        right: -3px;
        top: 0;
        bottom: 0;
        width: 6px;
        cursor: col-resize;
        z-index: 20;
        background: transparent;
        border-radius: 3px;
      }
      .dg-resize-handle:hover, .dg-resize-handle.dg-resizing { background: #6c5ce7; }
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
      /* Context Menu */
      .dg-context-menu {
        position: fixed;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        padding: 8px 0;
        z-index: 1000;
        min-width: 180px;
      }
      .dg-context-menu-item {
        padding: 10px 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
        color: #333;
        font-size: 14px;
      }
      .dg-context-menu-item:hover { background: #f5f5f5; }
      .dg-context-menu-item.disabled { color: #ccc; cursor: not-allowed; }
      .dg-context-menu-divider { height: 1px; background: #eee; margin: 8px 0; }
      .dg-context-menu-item .icon { width: 18px; text-align: center; }
    `;
    document.head.appendChild(style);
  }

  private contextMenu: HTMLElement | null = null;

  private showContextMenu(x: number, y: number, columnId: string): void {
    this.hideContextMenu();

    const col = this.columnManager.getColumn(columnId);
    if (!col) return;

    const pinPos = this.columnManager.getColumnPin(columnId);
    const isVisible = this.columnManager.isColumnVisible(columnId);

    const menu = document.createElement('div');
    menu.className = 'dg-context-menu';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    menu.innerHTML = `
      <div class="dg-context-menu-item" data-action="sort-asc">
        <span class="icon">▲</span> Sort Ascending
      </div>
      <div class="dg-context-menu-item" data-action="sort-desc">
        <span class="icon">▼</span> Sort Descending
      </div>
      <div class="dg-context-menu-item" data-action="sort-clear">
        <span class="icon">✕</span> Clear Sort
      </div>
      <div class="dg-context-menu-divider"></div>
      <div class="dg-context-menu-item" data-action="pin-left" ${pinPos === 'left' ? 'class="disabled"' : ''}>
        <span class="icon">📌</span> Pin Left
      </div>
      <div class="dg-context-menu-item" data-action="pin-right" ${pinPos === 'right' ? 'class="disabled"' : ''}>
        <span class="icon">📌</span> Pin Right
      </div>
      <div class="dg-context-menu-item" data-action="unpin" ${!pinPos ? 'class="disabled"' : ''}>
        <span class="icon">🔓</span> Unpin
      </div>
      <div class="dg-context-menu-divider"></div>
      <div class="dg-context-menu-item" data-action="toggle-visibility">
        <span class="icon">${isVisible ? '👁️' : '🔒'}</span> ${isVisible ? 'Hide Column' : 'Show Column'}
      </div>
    `;

    menu.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const item = target.closest('.dg-context-menu-item') as HTMLElement;
      if (!item || item.classList.contains('disabled')) return;

      const action = item.dataset.action;
      this.handleContextMenuAction(action!, columnId);
      this.hideContextMenu();
    });

    document.body.appendChild(menu);
    this.contextMenu = menu;

    setTimeout(() => {
      document.addEventListener('click', this.hideContextMenu.bind(this), { once: true });
    }, 0);
  }

  private hideContextMenu(): void {
    if (this.contextMenu) {
      this.contextMenu.remove();
      this.contextMenu = null;
    }
  }

  private handleContextMenuAction(action: string, columnId: string): void {
    switch (action) {
      case 'sort-asc':
        this.dataManager.addSortState(columnId, 'asc');
        this.events.onSort?.(this.dataManager.getSortState());
        break;
      case 'sort-desc':
        this.dataManager.addSortState(columnId, 'desc');
        this.events.onSort?.(this.dataManager.getSortState());
        break;
      case 'sort-clear':
        this.dataManager.clearSortState();
        this.events.onSort?.(this.dataManager.getSortState());
        break;
      case 'pin-left':
        this.columnManager.pinColumnLeft(columnId);
        break;
      case 'pin-right':
        this.columnManager.pinColumnRight(columnId);
        break;
      case 'unpin':
        this.columnManager.unpinColumn(columnId);
        break;
      case 'toggle-visibility':
        this.columnManager.toggleColumnVisibility(columnId);
        break;
    }
    this.render();
  }

  private showFilterPopup(colId: string, iconEl: HTMLElement): void {
    this.hideFilterPopup();

    const col = this.columnManager.getColumn(colId);
    if (!col) return;

    const rect = iconEl.getBoundingClientRect();

    const popup = document.createElement('div');
    popup.className = 'dg-filter-popup';
    popup.style.cssText = `position:fixed; top:${rect.bottom + 4}px; left:${rect.left}px; z-index:1000; background:white; border-radius:8px; box-shadow:0 4px 20px rgba(0,0,0,0.15); padding:8px 0; min-width:200px;`;

    const operators = this.getFilterOperatorsForType(col.filterType || col.type || 'text');

    let html = '<div style="padding:8px 16px; border-bottom:1px solid #eee; font-weight:600; color:#333; font-size:13px;">Filter</div>';
    html += `<div style="padding:8px 16px;"><select class="dg-filter-operator" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px; font-size:14px;">`;
    for (const op of operators) {
      html += `<option value="${op.value}">${op.label}</option>`;
    }
    html += '</select></div>';
    html += `<div style="padding:8px 16px;"><input type="text" class="dg-filter-value" placeholder="Value..." style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px; font-size:14px; box-sizing:border-box;" /></div>`;
    html += `<div style="padding:8px 16px; display:flex; gap:8px;">
      <button class="dg-filter-apply" style="flex:1; padding:8px; background:#6c5ce7; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:600;">Apply</button>
      <button class="dg-filter-clear" style="flex:1; padding:8px; background:#eee; color:#333; border:none; border-radius:6px; cursor:pointer;">Clear</button>
    </div>`;

    popup.innerHTML = html;
    document.body.appendChild(popup);

    const applyBtn = popup.querySelector('.dg-filter-apply') as HTMLElement;
    const clearBtn = popup.querySelector('.dg-filter-clear') as HTMLElement;
    const operatorSelect = popup.querySelector('.dg-filter-operator') as HTMLSelectElement;
    const valueInput = popup.querySelector('.dg-filter-value') as HTMLInputElement;

    applyBtn.addEventListener('click', () => {
      const operator = operatorSelect.value as FilterState['operator'];
      const value = valueInput.value;
      if (value.trim()) {
        this.dataManager.setFilterState([{ columnId: colId, type: col.filterType || 'text', operator, value }]);
        this.events.onFilter?.(this.dataManager.getFilterState());
        this.updateVirtualScroll();
        this.render();
      }
      this.hideFilterPopup();
    });

    clearBtn.addEventListener('click', () => {
      this.dataManager.setFilterState([]);
      this.events.onFilter?.([]);
      this.updateVirtualScroll();
      this.render();
      this.hideFilterPopup();
    });

    valueInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') applyBtn.click();
      if (e.key === 'Escape') this.hideFilterPopup();
    });

    popup.addEventListener('click', (e) => e.stopPropagation());

    this.filterPopup = popup;

    setTimeout(() => {
      document.addEventListener('click', this.hideFilterPopup.bind(this), { once: true });
    }, 0);
  }

  private hideFilterPopup(): void {
    if (this.filterPopup) {
      this.filterPopup.remove();
      this.filterPopup = null;
    }
  }

  private getFilterOperatorsForType(type: string): { value: string; label: string }[] {
    switch (type) {
      case 'text':
        return [
          { value: 'contains', label: 'Contains' },
          { value: 'notContains', label: 'Does not contain' },
          { value: 'equals', label: 'Equals' },
          { value: 'notEquals', label: 'Does not equal' },
          { value: 'startsWith', label: 'Starts with' },
          { value: 'endsWith', label: 'Ends with' },
          { value: 'blank', label: 'Is blank' },
          { value: 'notBlank', label: 'Is not blank' },
        ];
      case 'number':
        return [
          { value: 'equals', label: 'Equals' },
          { value: 'notEquals', label: 'Does not equal' },
          { value: 'greaterThan', label: 'Greater than' },
          { value: 'lessThan', label: 'Less than' },
          { value: 'greaterThanOrEqual', label: 'Greater than or equal' },
          { value: 'lessThanOrEqual', label: 'Less than or equal' },
          { value: 'inRange', label: 'In range' },
          { value: 'blank', label: 'Is blank' },
          { value: 'notBlank', label: 'Is not blank' },
        ];
      case 'date':
        return [
          { value: 'equals', label: 'Equals' },
          { value: 'notEquals', label: 'Does not equal' },
          { value: 'greaterThan', label: 'Greater than' },
          { value: 'lessThan', label: 'Less than' },
          { value: 'inRange', label: 'In range' },
          { value: 'blank', label: 'Is blank' },
          { value: 'notBlank', label: 'Is not blank' },
        ];
      case 'boolean':
        return [
          { value: 'true', label: 'True' },
          { value: 'false', label: 'False' },
        ];
      default:
        return [
          { value: 'contains', label: 'Contains' },
          { value: 'equals', label: 'Equals' },
        ];
    }
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
        e.preventDefault();
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
        e.preventDefault();
        e.stopPropagation();
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

      cell.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).classList.contains('dg-resize-handle')) return;
        if ((e.target as HTMLElement).classList.contains('dg-filter-icon')) return;

        const col = this.columnManager.getColumn(colId);
        if (!col || col.sortable === false) return;

        const isMultiSort = (e as MouseEvent).shiftKey && this.config.sorting.multiSort;
        const currentSort = this.dataManager.getSortState();
        const existing = currentSort.find(s => s.columnId === colId);

        if (isMultiSort) {
          if (existing) {
            if (existing.direction === 'asc') {
              this.dataManager.addSortState(colId, 'desc');
            } else {
              this.dataManager.setSortState(currentSort.filter(s => s.columnId !== colId));
            }
          } else {
            this.dataManager.addSortState(colId, 'asc');
          }
        } else {
          if (!existing) {
            this.dataManager.clearSortState();
            this.dataManager.addSortState(colId, 'asc');
          } else if (existing.direction === 'asc') {
            this.dataManager.addSortState(colId, 'desc');
          } else {
            this.dataManager.clearSortState();
          }
        }
        this.events.onSort?.(this.dataManager.getSortState());
        this.render();
      });

      cell.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const mouseEvent = e as MouseEvent;
        this.showContextMenu(mouseEvent.clientX, mouseEvent.clientY, colId);
      });

      const filterIcon = cell.querySelector('.dg-filter-icon');
      if (filterIcon) {
        filterIcon.addEventListener('click', (e) => {
          e.stopPropagation();
          this.showFilterPopup(colId, filterIcon as HTMLElement);
        });
      }
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
