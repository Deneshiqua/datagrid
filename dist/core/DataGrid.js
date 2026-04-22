// ============================================
// DataGrid - Main Entry Point
// High-performance JavaScript Data Grid
// ============================================
import { VirtualScroll } from './VirtualScroll';
import { DataManager } from './DataManager';
import { ColumnManager } from './ColumnManager';
export class DataGrid {
    constructor(container, options = {}) {
        this.container = null;
        this.scrollHandler = null;
        this.resizeObserver = null;
        this.isDestroyed = false;
        this.resizeStartX = 0;
        this.contextMenu = null;
        console.log('[DATAGRID] Constructor called, container:', container.tagName, container.id);
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
    getData() { return this.dataManager.getData(); }
    setData(data) {
        this.dataManager.setData(data);
        this.updateVirtualScroll();
        this.render();
    }
    getRow(rowId) { return this.dataManager.getRowById(rowId); }
    insertRow(index, row) {
        this.dataManager.insertRow(index, row);
        this.updateVirtualScroll();
        this.render();
    }
    deleteRow(rowId) {
        this.dataManager.deleteRow(rowId);
        this.updateVirtualScroll();
        this.render();
    }
    updateRow(rowId, data) {
        this.dataManager.updateRow(rowId, data);
        this.render();
    }
    batch(operations) {
        this.dataManager.batch(operations);
        this.updateVirtualScroll();
        this.render();
    }
    canUndo() { return this.dataManager.canUndo(); }
    canRedo() { return this.dataManager.canRedo(); }
    undo() {
        const result = this.dataManager.undo();
        if (result) {
            this.updateVirtualScroll();
            this.render();
        }
        return result;
    }
    redo() {
        const result = this.dataManager.redo();
        if (result) {
            this.updateVirtualScroll();
            this.render();
        }
        return result;
    }
    getSelectedRows() { return []; }
    clearSelection() { }
    getSortState() { return this.dataManager.getSortState(); }
    setSortState(state) {
        this.dataManager.setSortState(state);
        this.events.onSort?.(state);
        this.render();
    }
    getFilterState() { return this.dataManager.getFilterState(); }
    setFilterState(state) {
        this.dataManager.setFilterState(state);
        this.events.onFilter?.(state);
        this.updateVirtualScroll();
        this.render();
    }
    // ============================================
    // Public API - Columns
    // ============================================
    setColumns(columns) {
        this.columnManager = new ColumnManager(columns);
        this.render();
    }
    getColumn(columnId) {
        return this.columnManager.getColumn(columnId);
    }
    updateColumn(columnId, updates) {
        this.columnManager.updateColumn(columnId, updates);
        this.render();
    }
    setColumnWidth(columnId, width) {
        this.columnManager.setColumnWidth(columnId, width);
        this.render();
    }
    pinColumnLeft(columnId) { this.columnManager.pinColumnLeft(columnId); this.render(); }
    pinColumnRight(columnId) { this.columnManager.pinColumnRight(columnId); this.render(); }
    unpinColumn(columnId) { this.columnManager.unpinColumn(columnId); this.render(); }
    toggleColumnPin(columnId) { this.columnManager.toggleColumnPin(columnId); this.render(); }
    toggleColumnVisibility(columnId) { this.columnManager.toggleColumnVisibility(columnId); this.render(); }
    moveColumn(fromIndex, toIndex) { this.columnManager.moveColumn(fromIndex, toIndex); this.render(); }
    // ============================================
    // Public API - Scroll
    // ============================================
    refresh() { this.updateVirtualScroll(); this.render(); }
    scrollToRow(rowId) {
        const data = this.getData();
        const index = data.findIndex(row => this.dataManager.getRowId(row) === rowId);
        if (index >= 0) {
            const scrollTop = this.virtualScroll.scrollToIndex(index);
            this.setScrollPosition({ scrollTop, scrollLeft: 0 });
        }
    }
    getScrollPosition() {
        return { scrollTop: this.virtualScroll.getConfig().scrollTop, scrollLeft: 0 };
    }
    setScrollPosition(position) {
        const maxScrollTop = this.virtualScroll.getScrollRange();
        const newScrollTop = Math.max(0, Math.min(position.scrollTop, maxScrollTop));
        this.virtualScroll.setConfig({ scrollTop: newScrollTop });
        this.render();
        this.events.onScroll?.(position);
    }
    getViewportInfo() { return this.virtualScroll.compute().viewport; }
    exportToCSV() {
        const data = this.getData();
        const columns = this.columnManager.getVisibleColumns();
        const headers = columns.map(c => c.header);
        const rows = data.map(row => columns.map(col => {
            const value = row[col.field];
            const strValue = value === null || value === undefined ? '' : String(value);
            return strValue.includes(',') ? `"${strValue.replace(/"/g, '""')}"` : strValue;
        }).join(','));
        return [headers.join(','), ...rows].join('\n');
    }
    destroy() {
        this.isDestroyed = true;
        if (this.scrollHandler && this.container)
            this.container.removeEventListener('scroll', this.scrollHandler);
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        this.container = null;
    }
    // ============================================
    // Private Methods
    // ============================================
    setupContainer() {
        if (!this.container)
            return;
        this.container.style.overflow = 'auto';
        this.container.style.position = 'relative';
        const rect = this.container.getBoundingClientRect();
        this.virtualScroll.setConfig({ containerHeight: rect.height - this.config.headerHeight });
    }
    setupScrollHandling() {
        if (!this.container)
            return;
        let ticking = false;
        this.scrollHandler = (_e) => {
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
    setupResizeObserver() {
        if (!this.container)
            return;
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
    updateVirtualScroll() {
        const containerHeight = this.container?.clientHeight ? this.container.clientHeight - this.config.headerHeight : 600;
        this.virtualScroll.setConfig({
            itemCount: this.dataManager.getRowCount(),
            itemHeight: this.config.rowHeight,
            containerHeight,
        });
    }
    render() {
        if (!this.container || this.isDestroyed)
            return;
        console.log('[RENDER] Called, container exists:', !!this.container);
        const result = this.virtualScroll.compute();
        const data = this.getData();
        const visibleRange = result.visibleItems;
        const columns = this.columnManager.getColumnsInOrder();
        const sortStates = this.dataManager.getSortState();
        let html = '';
        // Header
        html += `<div class="dg-header" style="height: ${this.config.headerHeight}px; display: flex; position: relative;">`;
        for (const col of columns) {
            if (!this.columnManager.isColumnVisible(col.id))
                continue;
            const width = this.columnManager.getColumnWidth(col.id);
            const pinPos = this.columnManager.getColumnPin(col.id);
            const pinClass = pinPos === 'left' ? ' dg-pin-left' : pinPos === 'right' ? ' dg-pin-right' : '';
            // Sort state - show arrow for single, number for multi-sort
            const sortIndex = sortStates.findIndex(s => s.columnId === col.id);
            let sortIcon = '';
            if (sortIndex !== -1) {
                const direction = sortStates[sortIndex].direction;
                if (sortStates.length > 1) {
                    sortIcon = `<span class="dg-sort-badge">${sortIndex + 1}${direction === 'asc' ? ' ▲' : ' ▼'}</span>`;
                }
                else {
                    sortIcon = `<span class="dg-sort-arrow">${direction === 'asc' ? '▲' : '▼'}</span>`;
                }
            }
            html += `<div class="dg-header-cell${pinClass}" data-column-id="${col.id}" data-pinned="${pinPos || ''}" style="width: ${width}px; min-width: ${col.minWidth || 50}px;">
        <span class="dg-header-text">${col.header}${sortIcon}</span>
        <div class="dg-resize-handle" data-resize-column="${col.id}"></div>
      </div>`;
        }
        html += '</div>';
        // Body
        const bodyHeight = this.dataManager.getRowCount() * this.config.rowHeight;
        html += `<div class="dg-body" style="height: ${bodyHeight}px; position: relative;">`;
        for (let i = visibleRange.startIndex; i <= visibleRange.endIndex; i++) {
            if (i < 0 || i >= data.length)
                continue;
            const row = data[i];
            const rowId = this.dataManager.getRowId(row);
            const offsetY = i * this.config.rowHeight;
            html += `<div class="dg-row" data-row-id="${rowId}" style="position: absolute; top: ${offsetY}px; height: ${this.config.rowHeight}px; display: flex; width: 100%;">`;
            for (const col of columns) {
                if (!this.columnManager.isColumnVisible(col.id))
                    continue;
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
    injectStyles() {
        if (document.getElementById('datagrid-styles-v4'))
            return;
        const style = document.createElement('style');
        style.id = 'datagrid-styles-v4';
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
    showContextMenu(x, y, columnId) {
        this.hideContextMenu();
        const col = this.columnManager.getColumn(columnId);
        if (!col)
            return;
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
            const target = e.target;
            const item = target.closest('.dg-context-menu-item');
            if (!item || item.classList.contains('disabled'))
                return;
            const action = item.dataset.action;
            this.handleContextMenuAction(action, columnId);
            this.hideContextMenu();
        });
        document.body.appendChild(menu);
        this.contextMenu = menu;
        // Close on click outside
        setTimeout(() => {
            document.addEventListener('click', this.hideContextMenu.bind(this), { once: true });
        }, 0);
    }
    hideContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.remove();
            this.contextMenu = null;
        }
    }
    handleContextMenuAction(action, columnId) {
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
    injectEventHandlers() {
        if (!this.container)
            return;
        console.log('[INJECT] Container children:', this.container.children.length);
        console.log('[INJECT] Looking for resize handles...');
        // Resize handles
        const resizeHandles = this.container.querySelectorAll('.dg-resize-handle');
        console.log('[INJECT] Found resize handles:', resizeHandles.length);
        resizeHandles.forEach(handle => {
            const colId = handle.dataset.resizeColumn;
            if (!colId)
                return;
            let isResizing = false;
            const onMouseMove = (e) => {
                if (!isResizing)
                    return;
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
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[RESIZE] mousedown on column:', colId);
                isResizing = true;
                this.resizeStartX = e.clientX;
                handle.classList.add('dg-resizing');
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        });
        // Header click for sort
        const headerCells = this.container.querySelectorAll('.dg-header-cell');
        headerCells.forEach(cell => {
            const colId = cell.dataset.columnId;
            if (!colId)
                return;
            // Sort on click
            cell.addEventListener('click', (e) => {
                // Don't sort if clicking resize handle
                if (e.target.classList.contains('dg-resize-handle'))
                    return;
                const col = this.columnManager.getColumn(colId);
                if (!col || col.sortable === false)
                    return;
                const isMultiSort = e.shiftKey && this.config.sorting.multiSort;
                const currentSort = this.dataManager.getSortState();
                const existing = currentSort.find(s => s.columnId === colId);
                if (isMultiSort) {
                    // Multi-sort: toggle this column's direction, keep others
                    if (existing) {
                        if (existing.direction === 'asc') {
                            this.dataManager.addSortState(colId, 'desc');
                        }
                        else {
                            // Remove this column from sort
                            this.dataManager.setSortState(currentSort.filter(s => s.columnId !== colId));
                        }
                    }
                    else {
                        this.dataManager.addSortState(colId, 'asc');
                    }
                }
                else {
                    // Single sort: clear others first
                    if (!existing) {
                        this.dataManager.clearSortState();
                        this.dataManager.addSortState(colId, 'asc');
                    }
                    else if (existing.direction === 'asc') {
                        this.dataManager.addSortState(colId, 'desc');
                    }
                    else {
                        this.dataManager.clearSortState();
                    }
                }
                this.events.onSort?.(this.dataManager.getSortState());
                this.render();
            });
            // Right-click for context menu
            cell.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const mouseEvent = e;
                this.showContextMenu(mouseEvent.clientX, mouseEvent.clientY, colId);
            });
        });
        // Row click
        const rows = this.container.querySelectorAll('.dg-row');
        rows.forEach(row => {
            row.addEventListener('click', () => {
                const rowId = row.dataset.rowId;
                if (!rowId)
                    return;
                const rowData = this.dataManager.getRowById(rowId);
                if (rowData)
                    this.events.onRowClick?.(rowId, rowData);
            });
        });
    }
}
export default DataGrid;
//# sourceMappingURL=DataGrid.js.map