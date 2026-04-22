// src/core/VirtualScroll.ts
var VirtualScroll = class {
  constructor(config = {}) {
    this.lastComputedResult = null;
    this.config = {
      itemCount: 0,
      itemHeight: 48,
      bufferSize: 5,
      containerHeight: 600,
      scrollTop: 0,
      ...config
    };
  }
  /**
   * Update configuration
   */
  setConfig(config) {
    this.config = { ...this.config, ...config };
    this.lastComputedResult = null;
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
          offsetX: 0
        }
      };
      this.lastComputedResult = emptyResult;
      return emptyResult;
    }
    const totalHeight = itemCount * itemHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferSize);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const endIndex = Math.min(itemCount - 1, Math.ceil(scrollTop / itemHeight) + visibleCount + bufferSize);
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
        offsetX: 0
      }
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
};

// src/core/DataManager.ts
var DataManager = class {
  constructor(options = {}) {
    this.originalData = [];
    this.processedData = [];
    this.sortStates = [];
    this.filterStates = [];
    this.quickFilterValue = "";
    this.rowIdMap = /* @__PURE__ */ new Map();
    // Undo/Redo stacks
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistorySize = 50;
    // Change listeners
    this.listeners = /* @__PURE__ */ new Set();
    this.options = {
      idField: "id",
      sortable: true,
      filterable: true,
      ...options
    };
  }
  // ============================================
  // Data Access
  // ============================================
  setData(data) {
    this.originalData = [...data];
    this.buildRowIdMap();
    this.processData();
    this.clearHistory();
  }
  getData() {
    return [...this.processedData];
  }
  getOriginalData() {
    return [...this.originalData];
  }
  getRowCount() {
    return this.processedData.length;
  }
  getRowAt(index) {
    if (index < 0 || index >= this.processedData.length) return null;
    return { ...this.processedData[index] };
  }
  getRowById(id) {
    const index = this.rowIdMap.get(id);
    if (index === void 0) return null;
    return this.getRowAt(index);
  }
  getRowId(rowData) {
    const id = rowData[this.options.idField];
    return id !== void 0 && id !== null ? String(id) : Math.random().toString(36).substr(2, 9);
  }
  // ============================================
  // CRUD Operations (with Undo/Redo)
  // ============================================
  insertRow(index, row, recordHistory = true) {
    const insertIndex = Math.max(0, Math.min(index, this.originalData.length));
    if (recordHistory) {
      this.pushUndo([{
        type: "insert",
        index: insertIndex,
        data: { ...row }
      }]);
    }
    this.originalData.splice(insertIndex, 0, { ...row });
    this.buildRowIdMap();
    this.processData();
    this.notifyListeners();
  }
  deleteRow(id, recordHistory = true) {
    const index = this.rowIdMap.get(id);
    if (index === void 0) return false;
    if (recordHistory) {
      this.pushUndo([{
        type: "delete",
        rowId: id,
        index,
        previousData: { ...this.originalData[index] }
      }]);
    }
    this.originalData.splice(index, 1);
    this.buildRowIdMap();
    this.processData();
    this.notifyListeners();
    return true;
  }
  updateRow(id, data, recordHistory = true) {
    const index = this.rowIdMap.get(id);
    if (index === void 0) return false;
    if (recordHistory) {
      this.pushUndo([{
        type: "update",
        rowId: id,
        previousData: { ...this.originalData[index] }
      }]);
    }
    this.originalData[index] = { ...this.originalData[index], ...data };
    this.buildRowIdMap();
    this.processData();
    this.notifyListeners();
    return true;
  }
  // ============================================
  // Batch Operations
  // ============================================
  batch(operations, recordHistory = true) {
    if (operations.length === 0) return;
    const undoOps = [];
    for (const op of operations) {
      const undoOp = this.applyOperation(op, false);
      if (undoOp) undoOps.push(undoOp);
    }
    if (recordHistory && undoOps.length > 0) {
      this.pushUndo(undoOps);
    }
    this.buildRowIdMap();
    this.processData();
    this.notifyListeners();
  }
  applyOperation(op, recordHistory = true) {
    switch (op.type) {
      case "insert":
        if (op.index !== void 0 && op.data) {
          this.originalData.splice(op.index, 0, { ...op.data });
          return recordHistory ? { type: "delete", rowId: op.data[this.options.idField] } : null;
        }
        break;
      case "delete":
        if (op.index !== void 0 && op.previousData) {
          this.originalData.splice(op.index, 0, { ...op.previousData });
          return recordHistory ? { type: "insert", index: op.index, data: op.previousData } : null;
        }
        break;
      case "update":
        if (op.rowId && op.previousData) {
          const idx = this.rowIdMap.get(op.rowId);
          if (idx !== void 0) {
            const currentData = { ...this.originalData[idx] };
            this.originalData[idx] = { ...op.previousData };
            return recordHistory ? { type: "update", rowId: op.rowId, previousData: currentData } : null;
          }
        }
        break;
    }
    return null;
  }
  // ============================================
  // Undo/Redo
  // ============================================
  canUndo() {
    return this.undoStack.length > 0;
  }
  canRedo() {
    return this.redoStack.length > 0;
  }
  undo() {
    if (!this.canUndo()) return false;
    const ops = this.undoStack.pop();
    const reverseOps = [];
    for (let i = ops.length - 1; i >= 0; i--) {
      const reverseOp = this.applyOperation(ops[i], false);
      if (reverseOp) reverseOps.push(reverseOp);
    }
    this.redoStack.push(ops);
    this.buildRowIdMap();
    this.processData();
    this.notifyListeners();
    return true;
  }
  redo() {
    if (!this.canRedo()) return false;
    const ops = this.redoStack.pop();
    for (const op of ops) {
      this.applyOperation(op, false);
    }
    this.undoStack.push(ops);
    this.buildRowIdMap();
    this.processData();
    this.notifyListeners();
    return true;
  }
  pushUndo(ops) {
    this.undoStack.push(ops);
    this.redoStack = [];
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift();
    }
  }
  clearHistory() {
    this.undoStack = [];
    this.redoStack = [];
  }
  getHistorySize() {
    return {
      undo: this.undoStack.length,
      redo: this.redoStack.length
    };
  }
  // ============================================
  // Change Listeners
  // ============================================
  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  notifyListeners() {
    this.listeners.forEach((listener) => listener());
  }
  // ============================================
  // Sorting
  // ============================================
  getSortState() {
    return [...this.sortStates];
  }
  setSortState(states) {
    this.sortStates = [...states];
    this.processData();
    this.notifyListeners();
  }
  addSortState(columnId, direction) {
    const existingIndex = this.sortStates.findIndex((s) => s.columnId === columnId);
    if (existingIndex >= 0) {
      this.sortStates[existingIndex].direction = direction;
    } else {
      this.sortStates.push({ columnId, direction });
    }
    this.processData();
    this.notifyListeners();
  }
  clearSortState() {
    this.sortStates = [];
    this.processData();
    this.notifyListeners();
  }
  // ============================================
  // Filtering
  // ============================================
  getFilterState() {
    return [...this.filterStates];
  }
  setFilterState(states) {
    this.filterStates = [...states];
    this.processData();
    this.notifyListeners();
  }
  setQuickFilter(value) {
    this.quickFilterValue = value.toLowerCase().trim();
    this.processData();
    this.notifyListeners();
  }
  clearFilters() {
    this.filterStates = [];
    this.quickFilterValue = "";
    this.processData();
    this.notifyListeners();
  }
  // ============================================
  // Private Methods
  // ============================================
  processData() {
    let result = [...this.originalData];
    if (this.filterStates.length > 0 || this.quickFilterValue) {
      result = this.applyFilters(result);
    }
    if (this.sortStates.length > 0) {
      result = this.applySorting(result);
    }
    this.processedData = result;
  }
  applyFilters(data) {
    return data.filter((row) => {
      for (const filter of this.filterStates) {
        if (!this.matchesFilter(row, filter)) return false;
      }
      if (this.quickFilterValue) {
        const values = Object.values(row).join(" ").toLowerCase();
        if (!values.includes(this.quickFilterValue)) return false;
      }
      return true;
    });
  }
  matchesFilter(row, filter) {
    const value = row[filter.columnId];
    switch (filter.type) {
      case "text":
        return this.matchesTextFilter(value, filter);
      case "number":
        return this.matchesNumberFilter(value, filter);
      case "boolean":
        return Boolean(value) === Boolean(filter.value);
      case "set":
        return Array.isArray(filter.value) && filter.value.includes(value);
      default:
        return true;
    }
  }
  matchesTextFilter(value, filter) {
    const strValue = String(value || "").toLowerCase();
    const filterValue = String(filter.value || "").toLowerCase();
    const op = filter.operator || "contains";
    switch (op) {
      case "equals":
        return strValue === filterValue;
      case "startsWith":
        return strValue.startsWith(filterValue);
      case "endsWith":
        return strValue.endsWith(filterValue);
      default:
        return strValue.includes(filterValue);
    }
  }
  matchesNumberFilter(value, filter) {
    const numValue = Number(value);
    const filterValue = Number(filter.value);
    const op = filter.operator || "equals";
    switch (op) {
      case "greaterThan":
        return numValue > filterValue;
      case "lessThan":
        return numValue < filterValue;
      case "inRange":
        return Array.isArray(filter.value) && filter.value.length >= 2 && numValue >= Number(filter.value[0]) && numValue <= Number(filter.value[1]);
      default:
        return numValue === filterValue;
    }
  }
  applySorting(data) {
    return [...data].sort((a, b) => {
      for (const sortState of this.sortStates) {
        if (sortState.direction === null) continue;
        const aVal = a[sortState.columnId];
        const bVal = b[sortState.columnId];
        const cmp = this.compareValues(aVal, bVal);
        if (cmp !== 0) return sortState.direction === "asc" ? cmp : -cmp;
      }
      return 0;
    });
  }
  compareValues(a, b) {
    if (a == null && b == null) return 0;
    if (a == null) return -1;
    if (b == null) return 1;
    if (typeof a === "number" && typeof b === "number") return a - b;
    if (typeof a === "boolean" && typeof b === "boolean") return a === b ? 0 : a ? -1 : 1;
    return String(a).localeCompare(String(b));
  }
  buildRowIdMap() {
    this.rowIdMap.clear();
    this.originalData.forEach((row, index) => {
      const id = this.getRowId(row);
      this.rowIdMap.set(id, index);
    });
  }
};

// src/core/DataGrid.ts
var DataGrid = class {
  constructor(container, options = {}) {
    this.container = null;
    this.columns = /* @__PURE__ */ new Map();
    this.columnOrder = [];
    this.scrollHandler = null;
    this.resizeObserver = null;
    this.isDestroyed = false;
    this.container = container;
    this.config = {
      rowHeight: options.rowHeight ?? 48,
      headerHeight: options.headerHeight ?? 56,
      bufferSize: options.bufferSize ?? 5,
      autoHeight: options.autoHeight ?? false,
      selection: options.selection ?? { mode: "none" },
      sorting: options.sorting ?? { multiSort: false },
      filtering: options.filtering ?? { enabled: true, quickFilter: false },
      editing: options.editing ?? { enabled: false, mode: "cell" },
      pagination: options.pagination ?? { enabled: false, pageSize: 100, pageSizes: [25, 50, 100, 500] }
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
      onRowDoubleClick: options.onRowDoubleClick
    };
    this.virtualScroll = new VirtualScroll({
      itemHeight: this.config.rowHeight,
      bufferSize: this.config.bufferSize,
      itemCount: 0,
      containerHeight: 0,
      scrollTop: 0
    });
    this.dataManager = new DataManager({
      idField: "id",
      sortable: true,
      filterable: this.config.filtering.enabled
    });
    this.setupContainer();
    this.setupScrollHandling();
    this.setupResizeObserver();
  }
  // ============================================
  // Public API - Data
  // ============================================
  getData() {
    return this.dataManager.getData();
  }
  setData(data) {
    this.dataManager.setData(data);
    this.updateVirtualScroll();
    this.render();
  }
  getRow(rowId) {
    return this.dataManager.getRowById(rowId);
  }
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
  canUndo() {
    return this.dataManager.canUndo();
  }
  canRedo() {
    return this.dataManager.canRedo();
  }
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
  // ============================================
  // Public API - Selection
  // ============================================
  getSelectedRows() {
    return [];
  }
  clearSelection() {
  }
  // ============================================
  // Public API - Sorting & Filtering
  // ============================================
  getSortState() {
    return this.dataManager.getSortState();
  }
  setSortState(state) {
    this.dataManager.setSortState(state);
    this.events.onSort?.(state);
    this.render();
  }
  getFilterState() {
    return this.dataManager.getFilterState();
  }
  setFilterState(state) {
    this.dataManager.setFilterState(state);
    this.events.onFilter?.(state);
    this.updateVirtualScroll();
    this.render();
  }
  // ============================================
  // Public API - Scroll
  // ============================================
  refresh() {
    this.updateVirtualScroll();
    this.render();
  }
  scrollToRow(rowId) {
    const data = this.getData();
    const index = data.findIndex((row) => this.dataManager.getRowId(row) === rowId);
    if (index >= 0) {
      const scrollTop = this.virtualScroll.scrollToIndex(index);
      this.setScrollPosition({ scrollTop, scrollLeft: 0 });
    }
  }
  getScrollPosition() {
    return {
      scrollTop: this.virtualScroll.getConfig().scrollTop,
      scrollLeft: 0
    };
  }
  setScrollPosition(position) {
    const maxScrollTop = this.virtualScroll.getScrollRange();
    const newScrollTop = Math.max(0, Math.min(position.scrollTop, maxScrollTop));
    this.virtualScroll.setConfig({ scrollTop: newScrollTop });
    this.render();
    this.events.onScroll?.(position);
  }
  // ============================================
  // Public API - Export
  // ============================================
  exportToCSV() {
    const data = this.getData();
    const headers = this.columnOrder.map((id) => this.columns.get(id)?.header || id);
    const rows = data.map(
      (row) => this.columnOrder.map((id) => {
        const value = row[id];
        const strValue = value === null || value === void 0 ? "" : String(value);
        return strValue.includes(",") ? `"${strValue.replace(/"/g, '""')}"` : strValue;
      }).join(",")
    );
    return [headers.join(","), ...rows].join("\n");
  }
  // ============================================
  // Public API - Lifecycle
  // ============================================
  destroy() {
    this.isDestroyed = true;
    if (this.scrollHandler && this.container) {
      this.container.removeEventListener("scroll", this.scrollHandler);
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
  setColumns(columns) {
    this.columns.clear();
    this.columnOrder = [];
    for (const col of columns) {
      this.columns.set(col.id, col);
      this.columnOrder.push(col.id);
    }
    this.render();
  }
  getColumn(columnId) {
    return this.columns.get(columnId);
  }
  updateColumn(columnId, updates) {
    const col = this.columns.get(columnId);
    if (col) {
      this.columns.set(columnId, { ...col, ...updates });
      this.render();
    }
  }
  // ============================================
  // Viewport Info
  // ============================================
  getViewportInfo() {
    const result = this.virtualScroll.compute();
    return result.viewport;
  }
  // ============================================
  // Private Methods
  // ============================================
  setupContainer() {
    if (!this.container) return;
    this.container.style.overflow = "auto";
    this.container.style.position = "relative";
    const rect = this.container.getBoundingClientRect();
    this.virtualScroll.setConfig({
      containerHeight: rect.height - this.config.headerHeight
    });
  }
  setupScrollHandling() {
    if (!this.container) return;
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
    this.container.addEventListener("scroll", this.scrollHandler);
  }
  setupResizeObserver() {
    if (!this.container) return;
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { height } = entry.contentRect;
        this.virtualScroll.setConfig({
          containerHeight: height - this.config.headerHeight
        });
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
      containerHeight
    });
  }
  render() {
    if (!this.container || this.isDestroyed) return;
    const result = this.virtualScroll.compute();
    const data = this.getData();
    const visibleRange = result.visibleItems;
    let html = "";
    html += `<div class="dg-header" style="height: ${this.config.headerHeight}px; display: flex;">`;
    for (const colId of this.columnOrder) {
      const col = this.columns.get(colId);
      if (!col || col.visible === false) continue;
      html += `<div class="dg-header-cell" style="width: ${col.width || 100}px; min-width: ${col.minWidth || 50}px;">
        ${col.header}
      </div>`;
    }
    html += "</div>";
    const bodyHeight = this.dataManager.getRowCount() * this.config.rowHeight;
    html += `<div class="dg-body" style="height: ${bodyHeight}px; position: relative;">`;
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
      html += "</div>";
    }
    html += "</div>";
    this.injectStyles();
    this.container.innerHTML = html;
  }
  injectStyles() {
    if (document.getElementById("datagrid-styles")) return;
    const style = document.createElement("style");
    style.id = "datagrid-styles";
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
};
export {
  DataGrid,
  DataManager,
  VirtualScroll
};
//# sourceMappingURL=datagrid.esm.js.map
