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
        this.filterPopup = null;
        // Selection state
        this.selectedRows = new Set();
        this.lastSelectedIndex = -1;
        // Editing state
        this.editingCell = null;
        this.editValue = '';
        this.currentEditor = null;
        // Expanded groups state
        this.expandedGroups = new Set();
        this.contextMenu = null;
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
        this.stretchColumnsToFill();
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
    getSelectedRows() {
        const selected = [];
        this.selectedRows.forEach(rowId => {
            const row = this.dataManager.getRowById(rowId);
            if (row)
                selected.push(row);
        });
        return selected;
    }
    selectRow(rowId, addToSelection = false) {
        if (!addToSelection) {
            this.selectedRows.clear();
        }
        this.selectedRows.add(rowId);
        const data = this.getData();
        this.lastSelectedIndex = data.findIndex(row => this.dataManager.getRowId(row) === rowId);
        this.events.onSelect?.(Array.from(this.selectedRows));
        this.render();
    }
    deselectRow(rowId) {
        this.selectedRows.delete(rowId);
        this.events.onSelect?.(Array.from(this.selectedRows));
        this.render();
    }
    selectRange(startIndex, endIndex) {
        const data = this.getData();
        const start = Math.min(startIndex, endIndex);
        const end = Math.max(startIndex, endIndex);
        for (let i = start; i <= end && i < data.length; i++) {
            const rowId = this.dataManager.getRowId(data[i]);
            this.selectedRows.add(rowId);
        }
        this.events.onSelect?.(Array.from(this.selectedRows));
        this.render();
    }
    selectAll() {
        const data = this.getData();
        data.forEach(row => {
            this.selectedRows.add(this.dataManager.getRowId(row));
        });
        this.events.onSelect?.(Array.from(this.selectedRows));
        this.render();
    }
    clearSelection() {
        this.selectedRows.clear();
        this.lastSelectedIndex = -1;
        this.events.onSelect?.([]);
        this.render();
    }
    isRowSelected(rowId) {
        return this.selectedRows.has(rowId);
    }
    // Editing API
    startEdit(rowId, columnId) {
        if (!this.config.editing.enabled)
            return;
        const row = this.dataManager.getRowById(rowId);
        if (!row)
            return;
        const col = this.columnManager.getColumn(columnId);
        if (!col || col.editable === false)
            return;
        this.editingCell = { rowId, columnId };
        this.editValue = String(row[col.field] ?? '');
        this.events.onCellEditStart?.(rowId, columnId);
        // Store reference to the editor that will be created in render()
        setTimeout(() => {
            const editor = this.container?.querySelector('.dg-cell-editor');
            if (editor)
                this.currentEditor = editor;
        }, 0);
        this.render();
    }
    stopEdit(cancelled = false) {
        if (!this.editingCell)
            return;
        const { rowId, columnId } = this.editingCell;
        const col = this.columnManager.getColumn(columnId);
        const row = this.dataManager.getRowById(rowId);
        const originalValue = row ? row[col?.field || columnId] : null;
        if (!cancelled && col && row) {
            const newValue = this.parseValue(this.editValue, col.type || 'text');
            this.dataManager.updateRow(rowId, { [col.field]: newValue });
            this.events.onEdit?.(rowId, columnId, newValue);
            this.events.onCellEditEnd?.(rowId, columnId, newValue, false);
        }
        else if (cancelled) {
            this.events.onCellEditEnd?.(rowId, columnId, originalValue, true);
        }
        this.editingCell = null;
        this.editValue = '';
        this.currentEditor = null;
        this.render();
    }
    parseValue(value, type) {
        if (type === 'number')
            return parseFloat(value) || 0;
        if (type === 'boolean')
            return value.toLowerCase() === 'true';
        return value;
    }
    isEditing(rowId, columnId) {
        return this.editingCell?.rowId === rowId && this.editingCell?.columnId === columnId;
    }
    // ============================================
    // Grouping API
    // ============================================
    setGroupBy(columnId) {
        this.dataManager.setGroupBy(columnId);
        this.expandedGroups.clear();
        this.updateVirtualScroll();
        this.render();
    }
    clearGroup() {
        this.dataManager.clearGroup();
        this.expandedGroups.clear();
        this.updateVirtualScroll();
        this.render();
    }
    getGroupState() {
        return this.dataManager.getGroupState();
    }
    toggleGroup(groupKey) {
        this.dataManager.toggleGroup(groupKey);
        this.expandedGroups = this.dataManager.getExpandedGroups();
        this.updateVirtualScroll();
        this.render();
    }
    expandAllGroups() {
        const data = this.getData();
        data.forEach(row => {
            if (row['_isGroupHeader']) {
                this.dataManager.expandGroup(row['_groupKey']);
            }
        });
        this.expandedGroups = this.dataManager.getExpandedGroups();
        this.updateVirtualScroll();
        this.render();
    }
    collapseAllGroups() {
        this.expandedGroups.clear();
        // Reset all groups in data manager
        const data = this.getData();
        data.forEach(row => {
            if (row['_isGroupHeader']) {
                this.dataManager.collapseGroup(row['_groupKey']);
            }
        });
        this.updateVirtualScroll();
        this.render();
    }
    autoSizeColumn(columnId) {
        const col = this.columnManager.getColumn(columnId);
        if (!col)
            return;
        // Create temporary element to measure text width
        const measureEl = document.createElement('div');
        measureEl.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font-weight:600;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:0 12px;';
        document.body.appendChild(measureEl);
        let maxWidth = 0;
        const headerWidth = this.measureTextWidth(col.header, measureEl) + 60; // 60 for icons/spacing
        maxWidth = Math.max(maxWidth, headerWidth);
        // Measure all data rows
        const data = this.getData();
        const sampleSize = Math.min(data.length, 100); // Sample first 100 rows for performance
        for (let i = 0; i < sampleSize; i++) {
            const row = data[i];
            const value = row[col.field];
            const cellText = value === null || value === undefined ? '' : String(value);
            const cellWidth = this.measureTextWidth(cellText, measureEl) + 40; // 40 for padding
            maxWidth = Math.max(maxWidth, cellWidth);
        }
        document.body.removeChild(measureEl);
        // Apply with min/max bounds
        const finalWidth = Math.max(col.minWidth || 50, Math.min(maxWidth, col.maxWidth || 500));
        this.columnManager.setColumnWidth(columnId, finalWidth);
        this.render();
    }
    autoSizeAllColumns() {
        const columns = this.columnManager.getColumnsInOrder();
        for (const col of columns) {
            if (this.columnManager.isColumnVisible(col.id)) {
                this.autoSizeColumn(col.id);
            }
        }
        // After auto-sizing, stretch columns to fill container width
        this.stretchColumnsToFill();
    }
    stretchColumnsToFill() {
        if (!this.container)
            return;
        const containerWidth = this.container.clientWidth;
        const columns = this.columnManager.getColumnsInOrder().filter(col => this.columnManager.isColumnVisible(col.id));
        // Calculate current total width
        let totalWidth = 0;
        for (const col of columns) {
            totalWidth += this.columnManager.getColumnWidth(col.id);
        }
        // If we have extra space, distribute it across columns
        if (totalWidth < containerWidth && columns.length > 0) {
            const extraSpace = containerWidth - totalWidth;
            const extraPerColumn = Math.floor(extraSpace / columns.length);
            for (const col of columns) {
                const currentWidth = this.columnManager.getColumnWidth(col.id);
                this.columnManager.setColumnWidth(col.id, currentWidth + extraPerColumn);
            }
            this.render();
        }
    }
    measureTextWidth(text, measureEl) {
        measureEl.textContent = text;
        return measureEl.offsetWidth;
    }
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
        this.stretchColumnsToFill();
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
        const result = this.virtualScroll.compute();
        const data = this.getData();
        const visibleRange = result.visibleItems;
        const columns = this.columnManager.getColumnsInOrder();
        const sortStates = this.dataManager.getSortState();
        const filterStates = this.dataManager.getFilterState();
        let html = '';
        // Header
        html += `<div class="dg-header" style="height: ${this.config.headerHeight}px; display: flex; position: relative;">`;
        // Checkbox column for select all
        if (this.config.selection.mode !== 'none' && this.config.selection.checkboxes) {
            const allSelected = data.length > 0 && data.every(row => this.selectedRows.has(this.dataManager.getRowId(row)));
            html += `<div class="dg-header-cell dg-checkbox-cell" style="width: 50px; min-width: 50px;">
        <input type="checkbox" class="dg-select-all" ${allSelected ? 'checked' : ''} />
      </div>`;
        }
        for (const col of columns) {
            if (!this.columnManager.isColumnVisible(col.id))
                continue;
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
                }
                else {
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
            if (i < 0 || i >= data.length)
                continue;
            const row = data[i];
            const rowId = this.dataManager.getRowId(row);
            const offsetY = i * this.config.rowHeight;
            const isSelected = this.selectedRows.has(rowId);
            // Check if this is a group header row
            const isGroupHeader = row['_isGroupHeader'] === true;
            const groupKey = row['_groupKey'];
            const isExpanded = this.expandedGroups.has(groupKey);
            let rowClass = 'dg-row';
            if (isSelected)
                rowClass += ' selected';
            if (isGroupHeader)
                rowClass += ' dg-group-header';
            html += `<div class="${rowClass}" data-row-id="${rowId}" data-row-index="${i}" data-group-key="${groupKey || ''}" style="position: absolute; top: ${offsetY}px; height: ${this.config.rowHeight}px; display: flex; width: 100%;">`;
            // Group expand/collapse toggle
            if (isGroupHeader) {
                html += `<div class="dg-cell dg-group-toggle" data-group-key="${groupKey}" style="width: 40px; min-width: 40px; cursor: pointer; font-weight: bold; color: #6c5ce7;">
          ${isExpanded ? '▼' : '▶'}
        </div>`;
            }
            // Checkbox cell
            if (!isGroupHeader && this.config.selection.mode !== 'none' && this.config.selection.checkboxes) {
                html += `<div class="dg-cell dg-checkbox-cell" style="width: 50px; min-width: 50px;">
          <input type="checkbox" class="dg-row-checkbox" data-row-id="${rowId}" ${isSelected ? 'checked' : ''} />
        </div>`;
            }
            for (const col of columns) {
                if (!this.columnManager.isColumnVisible(col.id))
                    continue;
                const width = this.columnManager.getColumnWidth(col.id);
                const value = row[col.field];
                const displayValue = value === null || value === undefined ? '' : String(value);
                if (isGroupHeader) {
                    html += `<div class="dg-cell dg-group-header-cell" data-column-id="${col.id}" style="width: ${width}px; min-width: ${col.minWidth || 50}px; font-weight: bold; background: #e8e8e8;">
            ${col.renderCell ? col.renderCell(value, row, i) : displayValue}
          </div>`;
                }
                else {
                    const isEditing = this.isEditing(rowId, col.id);
                    const isEditable = col.editable !== false && this.config.editing.enabled;
                    if (isEditing) {
                        const inputType = col.type === 'number' ? 'number' : 'text';
                        html += `<div class="dg-cell dg-cell-editing" data-column-id="${col.id}" data-row-id="${rowId}" style="width: ${width}px; min-width: ${col.minWidth || 50}px; padding: 0;">
              <input type="${inputType}" class="dg-cell-editor" data-row-id="${rowId}" data-column-id="${col.id}" value="${this.editValue.replace(/"/g, '&quot;')}" style="width: 100%; height: 100%; border: 2px solid #6c5ce7; padding: 0 12px; font-size: 14px; outline: none;" />
            </div>`;
                    }
                    else {
                        html += `<div class="dg-cell${isEditable ? ' dg-cell-editable' : ''}" data-column-id="${col.id}" data-row-id="${rowId}" style="width: ${width}px; min-width: ${col.minWidth || 50}px;">
              ${col.renderCell ? col.renderCell(value, row, i) : displayValue}
            </div>`;
                    }
                }
            }
            html += '</div>';
        }
        html += '</div>';
        this.injectStyles();
        this.container.innerHTML = html;
        this.injectEventHandlers();
    }
    injectStyles() {
        if (document.getElementById('datagrid-styles-v5'))
            return;
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
      .dg-row.selected { background: rgba(108, 92, 231, 0.15) !important; }
      .dg-row.selected:hover { background: rgba(108, 92, 231, 0.25) !important; }
      .dg-cell-editable { cursor: pointer; }
      .dg-cell-editable:hover { background: rgba(108, 92, 231, 0.1); }
      .dg-cell-editing { padding: 0; }
      .dg-group-header { background: #e8e8e8 !important; font-weight: bold; }
      .dg-group-toggle { text-align: center; user-select: none; }
      .dg-group-header-cell { background: #e8e8e8 !important; }
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
      <div class="dg-context-menu-divider"></div>
      <div class="dg-context-menu-item" data-action="auto-size">
        <span class="icon">↔️</span> Auto-Size Column
      </div>
      <div class="dg-context-menu-item" data-action="auto-size-all">
        <span class="icon">↔️</span> Auto-Size All Columns
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
            case 'auto-size':
                this.autoSizeColumn(columnId);
                return; // Don't call render() again, autoSizeColumn already does
            case 'auto-size-all':
                this.autoSizeAllColumns();
                return;
        }
        this.render();
    }
    showFilterPopup(colId, iconEl) {
        this.hideFilterPopup();
        const col = this.columnManager.getColumn(colId);
        if (!col)
            return;
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
        const applyBtn = popup.querySelector('.dg-filter-apply');
        const clearBtn = popup.querySelector('.dg-filter-clear');
        const operatorSelect = popup.querySelector('.dg-filter-operator');
        const valueInput = popup.querySelector('.dg-filter-value');
        applyBtn.addEventListener('click', () => {
            const operator = operatorSelect.value;
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
            if (e.key === 'Enter')
                applyBtn.click();
            if (e.key === 'Escape')
                this.hideFilterPopup();
        });
        popup.addEventListener('click', (e) => e.stopPropagation());
        this.filterPopup = popup;
        setTimeout(() => {
            document.addEventListener('click', this.hideFilterPopup.bind(this), { once: true });
        }, 0);
    }
    hideFilterPopup() {
        if (this.filterPopup) {
            this.filterPopup.remove();
            this.filterPopup = null;
        }
    }
    getFilterOperatorsForType(type) {
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
    injectEventHandlers() {
        if (!this.container)
            return;
        // Resize handles
        const resizeHandles = this.container.querySelectorAll('.dg-resize-handle');
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
            cell.addEventListener('click', (e) => {
                if (e.target.classList.contains('dg-resize-handle'))
                    return;
                if (e.target.classList.contains('dg-filter-icon'))
                    return;
                const col = this.columnManager.getColumn(colId);
                if (!col || col.sortable === false)
                    return;
                const isMultiSort = e.shiftKey && this.config.sorting.multiSort;
                const currentSort = this.dataManager.getSortState();
                const existing = currentSort.find(s => s.columnId === colId);
                if (isMultiSort) {
                    if (existing) {
                        if (existing.direction === 'asc') {
                            this.dataManager.addSortState(colId, 'desc');
                        }
                        else {
                            this.dataManager.setSortState(currentSort.filter(s => s.columnId !== colId));
                        }
                    }
                    else {
                        this.dataManager.addSortState(colId, 'asc');
                    }
                }
                else {
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
            cell.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const mouseEvent = e;
                this.showContextMenu(mouseEvent.clientX, mouseEvent.clientY, colId);
            });
            const filterIcon = cell.querySelector('.dg-filter-icon');
            if (filterIcon) {
                filterIcon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showFilterPopup(colId, filterIcon);
                });
            }
        });
        // Row click
        const rows = this.container.querySelectorAll('.dg-row');
        rows.forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.classList.contains('dg-row-checkbox'))
                    return;
                const rowId = row.dataset.rowId;
                const rowIndex = parseInt(row.dataset.rowIndex || '-1');
                if (!rowId)
                    return;
                const rowData = this.dataManager.getRowById(rowId);
                if (rowData) {
                    this.events.onRowClick?.(rowId, rowData);
                }
                if (this.config.selection.mode === 'none')
                    return;
                const isCtrlPressed = e.ctrlKey || e.metaKey;
                const isShiftPressed = e.shiftKey;
                if (isShiftPressed && this.lastSelectedIndex >= 0) {
                    this.selectRange(this.lastSelectedIndex, rowIndex);
                }
                else if (isCtrlPressed) {
                    if (this.selectedRows.has(rowId)) {
                        this.deselectRow(rowId);
                    }
                    else {
                        this.selectRow(rowId, true);
                    }
                }
                else {
                    this.selectRow(rowId);
                }
            });
        });
        // Checkbox handlers
        const checkboxes = this.container.querySelectorAll('.dg-row-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                const rowId = checkbox.dataset.rowId;
                if (!rowId)
                    return;
                if (this.selectedRows.has(rowId)) {
                    this.deselectRow(rowId);
                }
                else {
                    this.selectRow(rowId, e.ctrlKey || e.metaKey);
                }
            });
        });
        // Select all
        const selectAllCheckbox = this.container.querySelector('.dg-select-all');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('click', (e) => {
                e.stopPropagation();
                if (selectAllCheckbox.checked) {
                    this.selectAll();
                }
                else {
                    this.clearSelection();
                }
            });
        }
        // Group toggle handlers
        const groupToggles = this.container.querySelectorAll('.dg-group-toggle');
        groupToggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const groupKey = toggle.dataset.groupKey;
                if (groupKey) {
                    this.toggleGroup(groupKey);
                }
            });
        });
        // Cell click for editing
        if (this.config.editing.enabled) {
            const editableCells = this.container.querySelectorAll('.dg-cell-editable');
            editableCells.forEach(cell => {
                cell.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const rowId = cell.dataset.rowId;
                    const columnId = cell.dataset.columnId;
                    if (rowId && columnId) {
                        // If already editing a different cell, save and move
                        if (this.editingCell && (this.editingCell.rowId !== rowId || this.editingCell.columnId !== columnId)) {
                            this.editValue = (this.currentEditor?.value) || '';
                            this.stopEdit(false);
                        }
                        this.startEdit(rowId, columnId);
                    }
                });
            });
            // Cell editor handlers
            const editors = this.container.querySelectorAll('.dg-cell-editor');
            editors.forEach(editor => {
                const input = editor;
                input.focus();
                input.select();
                this.currentEditor = input;
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        this.editValue = input.value;
                        this.stopEdit(false);
                    }
                    else if (e.key === 'Escape') {
                        this.stopEdit(true);
                    }
                    else if (e.key === 'Tab') {
                        e.preventDefault();
                        this.editValue = input.value;
                        this.stopEdit(false);
                        // Move to next/prev cell
                        const rowId = input.dataset.rowId;
                        const columnId = input.dataset.columnId;
                        if (rowId && columnId) {
                            const columns = this.columnManager.getVisibleColumns();
                            const colIndex = columns.findIndex(c => c.id === columnId);
                            const data = this.getData();
                            const rowIndex = data.findIndex(r => this.dataManager.getRowId(r) === rowId);
                            let nextColIndex = e.shiftKey ? colIndex - 1 : colIndex + 1;
                            if (nextColIndex >= 0 && nextColIndex < columns.length) {
                                this.startEdit(rowId, columns[nextColIndex].id);
                            }
                            else if (!e.shiftKey && rowIndex < data.length - 1) {
                                // Next row, first column
                                const nextRowId = this.dataManager.getRowId(data[rowIndex + 1]);
                                this.startEdit(nextRowId, columns[0].id);
                            }
                        }
                    }
                });
                input.addEventListener('blur', () => {
                    // Only stop edit if this is still the current editor
                    if (this.currentEditor === input) {
                        this.editValue = input.value;
                        this.stopEdit(false);
                    }
                });
            });
        }
    }
}
export default DataGrid;
//# sourceMappingURL=DataGrid.js.map