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

// src/core/ColumnManager.ts
var ColumnManager = class {
  constructor(columns = []) {
    this.columns = /* @__PURE__ */ new Map();
    this.columnOrder = [];
    this.columnStates = /* @__PURE__ */ new Map();
    this.listeners = /* @__PURE__ */ new Set();
    columns.forEach((col) => this.addColumn(col));
  }
  // ============================================
  // Column CRUD
  // ============================================
  addColumn(col) {
    this.columns.set(col.id, { ...col });
    this.columnOrder.push(col.id);
    this.columnStates.set(col.id, {
      width: col.width || 100,
      minWidth: col.minWidth || 50,
      maxWidth: col.maxWidth || 1e3,
      visible: col.visible !== false,
      pinned: col.pinned || null,
      order: this.columnOrder.length - 1
    });
  }
  getColumn(id) {
    return this.columns.get(id);
  }
  getColumns() {
    return this.getColumnsInOrder();
  }
  getColumnsInOrder() {
    const pinnedLeft = this.columnOrder.filter((id) => this.columnStates.get(id)?.pinned === "left").sort((a, b) => (this.columnStates.get(a)?.order || 0) - (this.columnStates.get(b)?.order || 0));
    const unpinned = this.columnOrder.filter((id) => !this.columnStates.get(id)?.pinned).sort((a, b) => (this.columnStates.get(a)?.order || 0) - (this.columnStates.get(b)?.order || 0));
    const pinnedRight = this.columnOrder.filter((id) => this.columnStates.get(id)?.pinned === "right").sort((a, b) => (this.columnStates.get(a)?.order || 0) - (this.columnStates.get(b)?.order || 0));
    return [...pinnedLeft, ...unpinned, ...pinnedRight].map((id) => this.columns.get(id)).filter(Boolean);
  }
  getVisibleColumns() {
    return this.getColumnsInOrder().filter((col) => this.isColumnVisible(col.id));
  }
  updateColumn(id, updates) {
    const col = this.columns.get(id);
    if (col) {
      this.columns.set(id, { ...col, ...updates });
      this.notifyListeners();
    }
  }
  deleteColumn(id) {
    this.columns.delete(id);
    this.columnStates.delete(id);
    this.columnOrder = this.columnOrder.filter((colId) => colId !== id);
    this.notifyListeners();
  }
  // ============================================
  // Column State Operations
  // ============================================
  isColumnVisible(id) {
    return this.columnStates.get(id)?.visible ?? true;
  }
  setColumnVisible(id, visible) {
    const state = this.columnStates.get(id);
    if (state) {
      state.visible = visible;
      this.notifyListeners();
    }
  }
  toggleColumnVisibility(id) {
    const state = this.columnStates.get(id);
    if (state) {
      state.visible = !state.visible;
      this.notifyListeners();
    }
  }
  // ============================================
  // Column Sizing
  // ============================================
  getColumnWidth(id) {
    return this.columnStates.get(id)?.width || 100;
  }
  setColumnWidth(id, width) {
    const state = this.columnStates.get(id);
    if (state) {
      state.width = Math.max(state.minWidth, Math.min(state.maxWidth, width));
      this.notifyListeners();
    }
  }
  getColumnMinWidth(id) {
    return this.columnStates.get(id)?.minWidth || 50;
  }
  getColumnMaxWidth(id) {
    return this.columnStates.get(id)?.maxWidth || 1e3;
  }
  // ============================================
  // Column Reorder
  // ============================================
  moveColumn(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || toIndex < 0) return;
    if (fromIndex >= this.columnOrder.length || toIndex >= this.columnOrder.length) return;
    const item = this.columnOrder.splice(fromIndex, 1)[0];
    this.columnOrder.splice(toIndex, 0, item);
    this.columnOrder.forEach((id, idx) => {
      const state = this.columnStates.get(id);
      if (state) state.order = idx;
    });
    this.notifyListeners();
  }
  getColumnIndex(id) {
    return this.columnOrder.indexOf(id);
  }
  reorderColumns(newOrder) {
    if (newOrder.length !== this.columnOrder.length) return;
    if (!newOrder.every((id) => this.columnOrder.includes(id))) return;
    this.columnOrder = [...newOrder];
    this.columnOrder.forEach((id, idx) => {
      const state = this.columnStates.get(id);
      if (state) state.order = idx;
    });
    this.notifyListeners();
  }
  // ============================================
  // Column Pin
  // ============================================
  getColumnPin(id) {
    return this.columnStates.get(id)?.pinned || null;
  }
  setColumnPin(id, position) {
    const state = this.columnStates.get(id);
    if (state) {
      state.pinned = position;
      this.notifyListeners();
    }
  }
  pinColumnLeft(id) {
    this.setColumnPin(id, "left");
  }
  pinColumnRight(id) {
    this.setColumnPin(id, "right");
  }
  unpinColumn(id) {
    this.setColumnPin(id, null);
  }
  toggleColumnPin(id) {
    const current = this.getColumnPin(id);
    if (current === "left") {
      this.setColumnPin(id, "right");
    } else if (current === "right") {
      this.setColumnPin(id, null);
    } else {
      this.setColumnPin(id, "left");
    }
  }
  // ============================================
  // Listeners
  // ============================================
  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  notifyListeners() {
    this.listeners.forEach((listener) => listener());
  }
  // ============================================
  // Serialization (for save/restore)
  // ============================================
  getState() {
    const state = {};
    this.columnStates.forEach((s, id) => {
      state[id] = { ...s };
    });
    return state;
  }
  setState(state) {
    state && Object.entries(state).forEach(([id, s]) => {
      if (this.columnStates.has(id)) {
        this.columnStates.set(id, { ...s });
      }
    });
    this.notifyListeners();
  }
};

// src/core/DataGrid.ts
var DataGrid = class {
  constructor(container, options = {}) {
    this.container = null;
    this.scrollHandler = null;
    this.resizeObserver = null;
    this.isDestroyed = false;
    this.resizeStartX = 0;
    this.contextMenu = null;
    console.log("[DATAGRID] Constructor called, container:", container.tagName, container.id);
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
    this.columnManager = new ColumnManager();
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
  getSelectedRows() {
    return [];
  }
  clearSelection() {
  }
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
  pinColumnLeft(columnId) {
    this.columnManager.pinColumnLeft(columnId);
    this.render();
  }
  pinColumnRight(columnId) {
    this.columnManager.pinColumnRight(columnId);
    this.render();
  }
  unpinColumn(columnId) {
    this.columnManager.unpinColumn(columnId);
    this.render();
  }
  toggleColumnPin(columnId) {
    this.columnManager.toggleColumnPin(columnId);
    this.render();
  }
  toggleColumnVisibility(columnId) {
    this.columnManager.toggleColumnVisibility(columnId);
    this.render();
  }
  moveColumn(fromIndex, toIndex) {
    this.columnManager.moveColumn(fromIndex, toIndex);
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
    return { scrollTop: this.virtualScroll.getConfig().scrollTop, scrollLeft: 0 };
  }
  setScrollPosition(position) {
    const maxScrollTop = this.virtualScroll.getScrollRange();
    const newScrollTop = Math.max(0, Math.min(position.scrollTop, maxScrollTop));
    this.virtualScroll.setConfig({ scrollTop: newScrollTop });
    this.render();
    this.events.onScroll?.(position);
  }
  getViewportInfo() {
    return this.virtualScroll.compute().viewport;
  }
  exportToCSV() {
    const data = this.getData();
    const columns = this.columnManager.getVisibleColumns();
    const headers = columns.map((c) => c.header);
    const rows = data.map(
      (row) => columns.map((col) => {
        const value = row[col.field];
        const strValue = value === null || value === void 0 ? "" : String(value);
        return strValue.includes(",") ? `"${strValue.replace(/"/g, '""')}"` : strValue;
      }).join(",")
    );
    return [headers.join(","), ...rows].join("\n");
  }
  destroy() {
    this.isDestroyed = true;
    if (this.scrollHandler && this.container) this.container.removeEventListener("scroll", this.scrollHandler);
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
    if (!this.container) return;
    this.container.style.overflow = "auto";
    this.container.style.position = "relative";
    const rect = this.container.getBoundingClientRect();
    this.virtualScroll.setConfig({ containerHeight: rect.height - this.config.headerHeight });
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
      containerHeight
    });
  }
  render() {
    if (!this.container || this.isDestroyed) return;
    console.log("[RENDER] Called, container exists:", !!this.container);
    const result = this.virtualScroll.compute();
    const data = this.getData();
    const visibleRange = result.visibleItems;
    const columns = this.columnManager.getColumnsInOrder();
    const sortStates = this.dataManager.getSortState();
    let html = "";
    html += `<div class="dg-header" style="height: ${this.config.headerHeight}px; display: flex; position: relative;">`;
    for (const col of columns) {
      if (!this.columnManager.isColumnVisible(col.id)) continue;
      const width = this.columnManager.getColumnWidth(col.id);
      const pinPos = this.columnManager.getColumnPin(col.id);
      const pinClass = pinPos === "left" ? " dg-pin-left" : pinPos === "right" ? " dg-pin-right" : "";
      const sortIndex = sortStates.findIndex((s) => s.columnId === col.id);
      let sortIcon = "";
      if (sortIndex !== -1) {
        const direction = sortStates[sortIndex].direction;
        if (sortStates.length > 1) {
          sortIcon = `<span class="dg-sort-badge">${sortIndex + 1}${direction === "asc" ? " \u25B2" : " \u25BC"}</span>`;
        } else {
          sortIcon = `<span class="dg-sort-arrow">${direction === "asc" ? "\u25B2" : "\u25BC"}</span>`;
        }
      }
      const hasFilter = this.config.filtering.enabled;
      html += `<div class="dg-header-cell${pinClass}" data-column-id="${col.id}" data-pinned="${pinPos || ""}" style="width: ${width}px; min-width: ${col.minWidth || 50}px;">
        <span class="dg-header-text">${col.header}${sortIcon}</span>
        ${hasFilter ? `<input type="text" class="dg-filter-input" data-filter-column="${col.id}" placeholder="\u{1F50D}" />` : ""}
        <div class="dg-resize-handle" data-resize-column="${col.id}"></div>
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
      for (const col of columns) {
        if (!this.columnManager.isColumnVisible(col.id)) continue;
        const width = this.columnManager.getColumnWidth(col.id);
        const value = row[col.field];
        const displayValue = value === null || value === void 0 ? "" : String(value);
        html += `<div class="dg-cell" data-column-id="${col.id}" style="width: ${width}px; min-width: ${col.minWidth || 50}px;">
          ${col.renderCell ? col.renderCell(value, row, i) : displayValue}
        </div>`;
      }
      html += "</div>";
    }
    html += "</div>";
    this.injectStyles();
    this.container.innerHTML = html;
    this.injectEventHandlers();
  }
  injectStyles() {
    if (document.getElementById("datagrid-styles-v4")) return;
    const style = document.createElement("style");
    style.id = "datagrid-styles-v4";
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
      .dg-filter-input { width: 30px; border: none; background: transparent; font-size: 12px; padding: 2px; margin-left: 4px; }
      .dg-filter-input:focus { width: 80px; background: white; border: 1px solid #6c5ce7; border-radius: 4px; outline: none; }
      .dg-filter-input.has-value { color: #6c5ce7; font-weight: bold; }
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
    if (!col) return;
    const pinPos = this.columnManager.getColumnPin(columnId);
    const isVisible = this.columnManager.isColumnVisible(columnId);
    const menu = document.createElement("div");
    menu.className = "dg-context-menu";
    menu.style.left = x + "px";
    menu.style.top = y + "px";
    menu.innerHTML = `
      <div class="dg-context-menu-item" data-action="sort-asc">
        <span class="icon">\u25B2</span> Sort Ascending
      </div>
      <div class="dg-context-menu-item" data-action="sort-desc">
        <span class="icon">\u25BC</span> Sort Descending
      </div>
      <div class="dg-context-menu-item" data-action="sort-clear">
        <span class="icon">\u2715</span> Clear Sort
      </div>
      <div class="dg-context-menu-divider"></div>
      <div class="dg-context-menu-item" data-action="pin-left" ${pinPos === "left" ? 'class="disabled"' : ""}>
        <span class="icon">\u{1F4CC}</span> Pin Left
      </div>
      <div class="dg-context-menu-item" data-action="pin-right" ${pinPos === "right" ? 'class="disabled"' : ""}>
        <span class="icon">\u{1F4CC}</span> Pin Right
      </div>
      <div class="dg-context-menu-item" data-action="unpin" ${!pinPos ? 'class="disabled"' : ""}>
        <span class="icon">\u{1F513}</span> Unpin
      </div>
      <div class="dg-context-menu-divider"></div>
      <div class="dg-context-menu-item" data-action="toggle-visibility">
        <span class="icon">${isVisible ? "\u{1F441}\uFE0F" : "\u{1F512}"}</span> ${isVisible ? "Hide Column" : "Show Column"}
      </div>
    `;
    menu.addEventListener("click", (e) => {
      const target = e.target;
      const item = target.closest(".dg-context-menu-item");
      if (!item || item.classList.contains("disabled")) return;
      const action = item.dataset.action;
      this.handleContextMenuAction(action, columnId);
      this.hideContextMenu();
    });
    document.body.appendChild(menu);
    this.contextMenu = menu;
    setTimeout(() => {
      document.addEventListener("click", this.hideContextMenu.bind(this), { once: true });
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
      case "sort-asc":
        this.dataManager.addSortState(columnId, "asc");
        this.events.onSort?.(this.dataManager.getSortState());
        break;
      case "sort-desc":
        this.dataManager.addSortState(columnId, "desc");
        this.events.onSort?.(this.dataManager.getSortState());
        break;
      case "sort-clear":
        this.dataManager.clearSortState();
        this.events.onSort?.(this.dataManager.getSortState());
        break;
      case "pin-left":
        this.columnManager.pinColumnLeft(columnId);
        break;
      case "pin-right":
        this.columnManager.pinColumnRight(columnId);
        break;
      case "unpin":
        this.columnManager.unpinColumn(columnId);
        break;
      case "toggle-visibility":
        this.columnManager.toggleColumnVisibility(columnId);
        break;
    }
    this.render();
  }
  injectEventHandlers() {
    if (!this.container) return;
    console.log("[INJECT] Container children:", this.container.children.length);
    console.log("[INJECT] Looking for resize handles...");
    const resizeHandles = this.container.querySelectorAll(".dg-resize-handle");
    console.log("[INJECT] Found resize handles:", resizeHandles.length);
    resizeHandles.forEach((handle) => {
      const colId = handle.dataset.resizeColumn;
      if (!colId) return;
      let isResizing = false;
      const onMouseMove = (e) => {
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
        handle.classList.remove("dg-resizing");
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };
      handle.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("[RESIZE] mousedown on column:", colId);
        isResizing = true;
        this.resizeStartX = e.clientX;
        handle.classList.add("dg-resizing");
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      });
    });
    const headerCells = this.container.querySelectorAll(".dg-header-cell");
    headerCells.forEach((cell) => {
      const colId = cell.dataset.columnId;
      if (!colId) return;
      cell.addEventListener("click", (e) => {
        if (e.target.classList.contains("dg-resize-handle")) return;
        const col = this.columnManager.getColumn(colId);
        if (!col || col.sortable === false) return;
        const isMultiSort = e.shiftKey && this.config.sorting.multiSort;
        const currentSort = this.dataManager.getSortState();
        const existing = currentSort.find((s) => s.columnId === colId);
        if (isMultiSort) {
          if (existing) {
            if (existing.direction === "asc") {
              this.dataManager.addSortState(colId, "desc");
            } else {
              this.dataManager.setSortState(currentSort.filter((s) => s.columnId !== colId));
            }
          } else {
            this.dataManager.addSortState(colId, "asc");
          }
        } else {
          if (!existing) {
            this.dataManager.clearSortState();
            this.dataManager.addSortState(colId, "asc");
          } else if (existing.direction === "asc") {
            this.dataManager.addSortState(colId, "desc");
          } else {
            this.dataManager.clearSortState();
          }
        }
        this.events.onSort?.(this.dataManager.getSortState());
        this.render();
      });
      cell.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const mouseEvent = e;
        this.showContextMenu(mouseEvent.clientX, mouseEvent.clientY, colId);
      });
    });
    const filterInputs = this.container.querySelectorAll(".dg-filter-input");
    filterInputs.forEach((input) => {
      const colId = input.dataset.filterColumn;
      if (!colId) return;
      input.addEventListener("input", (e) => {
        const value = e.target.value;
        if (value.trim()) {
          this.dataManager.setFilterState([{ columnId: colId, type: "text", operator: "contains", value }]);
          input.classList.add("has-value");
        } else {
          this.dataManager.setFilterState([]);
          input.classList.remove("has-value");
        }
        this.events.onFilter?.(this.dataManager.getFilterState());
        this.updateVirtualScroll();
        this.render();
      });
      input.addEventListener("click", (e) => {
        e.stopPropagation();
      });
    });
    const rows = this.container.querySelectorAll(".dg-row");
    rows.forEach((row) => {
      row.addEventListener("click", () => {
        const rowId = row.dataset.rowId;
        if (!rowId) return;
        const rowData = this.dataManager.getRowById(rowId);
        if (rowData) this.events.onRowClick?.(rowId, rowData);
      });
    });
  }
};
export {
  ColumnManager,
  DataGrid,
  DataManager,
  VirtualScroll
};
//# sourceMappingURL=datagrid.esm.js.map
