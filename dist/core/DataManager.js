// ============================================
// DataManager - Data CRUD, Sorting, Filtering + Undo/Redo
// ============================================
export class DataManager {
    constructor(options = {}) {
        this.originalData = [];
        this.processedData = [];
        this.sortStates = [];
        this.filterStates = [];
        this.quickFilterValue = '';
        this.rowIdMap = new Map();
        // Undo/Redo stacks
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistorySize = 50;
        // Change listeners
        this.listeners = new Set();
        // Grouping
        this.groupState = null;
        this.expandedGroups = new Set();
        this.options = {
            idField: 'id',
            sortable: true,
            filterable: true,
            ...options,
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
        if (index < 0 || index >= this.processedData.length)
            return null;
        return { ...this.processedData[index] };
    }
    getRowById(id) {
        const index = this.rowIdMap.get(id);
        if (index === undefined)
            return null;
        return this.getRowAt(index);
    }
    getRowId(rowData) {
        const id = rowData[this.options.idField];
        return id !== undefined && id !== null ? String(id) : Math.random().toString(36).substr(2, 9);
    }
    // ============================================
    // CRUD Operations (with Undo/Redo)
    // ============================================
    insertRow(index, row, recordHistory = true) {
        const insertIndex = Math.max(0, Math.min(index, this.originalData.length));
        if (recordHistory) {
            this.pushUndo([{
                    type: 'insert',
                    index: insertIndex,
                    data: { ...row },
                }]);
        }
        this.originalData.splice(insertIndex, 0, { ...row });
        this.buildRowIdMap();
        this.processData();
        this.notifyListeners();
    }
    deleteRow(id, recordHistory = true) {
        const index = this.rowIdMap.get(id);
        if (index === undefined)
            return false;
        if (recordHistory) {
            this.pushUndo([{
                    type: 'delete',
                    rowId: id,
                    index,
                    previousData: { ...this.originalData[index] },
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
        if (index === undefined)
            return false;
        if (recordHistory) {
            this.pushUndo([{
                    type: 'update',
                    rowId: id,
                    previousData: { ...this.originalData[index] },
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
        if (operations.length === 0)
            return;
        const undoOps = [];
        // Apply all operations
        for (const op of operations) {
            const undoOp = this.applyOperation(op, false);
            if (undoOp)
                undoOps.push(undoOp);
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
            case 'insert':
                if (op.index !== undefined && op.data) {
                    this.originalData.splice(op.index, 0, { ...op.data });
                    return recordHistory ? { type: 'delete', rowId: op.data[this.options.idField] } : null;
                }
                break;
            case 'delete':
                if (op.index !== undefined && op.previousData) {
                    this.originalData.splice(op.index, 0, { ...op.previousData });
                    return recordHistory ? { type: 'insert', index: op.index, data: op.previousData } : null;
                }
                break;
            case 'update':
                if (op.rowId && op.previousData) {
                    const idx = this.rowIdMap.get(op.rowId);
                    if (idx !== undefined) {
                        const currentData = { ...this.originalData[idx] };
                        this.originalData[idx] = { ...op.previousData };
                        return recordHistory ? { type: 'update', rowId: op.rowId, previousData: currentData } : null;
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
        if (!this.canUndo())
            return false;
        const ops = this.undoStack.pop();
        const reverseOps = [];
        // Apply reverse operations (in reverse order)
        for (let i = ops.length - 1; i >= 0; i--) {
            const reverseOp = this.applyOperation(ops[i], false);
            if (reverseOp)
                reverseOps.push(reverseOp);
        }
        this.redoStack.push(ops);
        this.buildRowIdMap();
        this.processData();
        this.notifyListeners();
        return true;
    }
    redo() {
        if (!this.canRedo())
            return false;
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
        this.redoStack = []; // Clear redo on new action
        // Limit history size
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
            redo: this.redoStack.length,
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
        this.listeners.forEach(listener => listener());
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
        const existingIndex = this.sortStates.findIndex(s => s.columnId === columnId);
        if (existingIndex >= 0) {
            this.sortStates[existingIndex].direction = direction;
        }
        else {
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
        this.quickFilterValue = '';
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
        if (this.groupState) {
            result = this.applyGrouping(result);
        }
        this.processedData = result;
    }
    applyFilters(data) {
        return data.filter(row => {
            for (const filter of this.filterStates) {
                if (!this.matchesFilter(row, filter))
                    return false;
            }
            if (this.quickFilterValue) {
                const values = Object.values(row).join(' ').toLowerCase();
                if (!values.includes(this.quickFilterValue))
                    return false;
            }
            return true;
        });
    }
    matchesFilter(row, filter) {
        const value = row[filter.columnId];
        switch (filter.type) {
            case 'text': return this.matchesTextFilter(value, filter);
            case 'number': return this.matchesNumberFilter(value, filter);
            case 'boolean': return Boolean(value) === Boolean(filter.value);
            case 'set': return Array.isArray(filter.value) && filter.value.includes(value);
            default: return true;
        }
    }
    matchesTextFilter(value, filter) {
        const strValue = String(value || '').toLowerCase();
        const filterValue = String(filter.value || '').toLowerCase();
        const op = filter.operator || 'contains';
        switch (op) {
            case 'equals': return strValue === filterValue;
            case 'notEquals': return strValue !== filterValue;
            case 'startsWith': return strValue.startsWith(filterValue);
            case 'endsWith': return strValue.endsWith(filterValue);
            case 'notContains': return !strValue.includes(filterValue);
            case 'blank': return strValue === '';
            case 'notBlank': return strValue !== '';
            default: return strValue.includes(filterValue);
        }
    }
    matchesNumberFilter(value, filter) {
        const numValue = Number(value);
        const filterValue = Number(filter.value);
        const op = filter.operator || 'equals';
        switch (op) {
            case 'equals': return numValue === filterValue;
            case 'notEquals': return numValue !== filterValue;
            case 'greaterThan': return numValue > filterValue;
            case 'lessThan': return numValue < filterValue;
            case 'greaterThanOrEqual': return numValue >= filterValue;
            case 'lessThanOrEqual': return numValue <= filterValue;
            case 'inRange': return Array.isArray(filter.value) && filter.value.length >= 2 && numValue >= Number(filter.value[0]) && numValue <= Number(filter.value[1]);
            case 'blank': return isNaN(numValue);
            case 'notBlank': return !isNaN(numValue);
            default: return numValue === filterValue;
        }
    }
    applySorting(data) {
        return [...data].sort((a, b) => {
            for (const sortState of this.sortStates) {
                if (sortState.direction === null)
                    continue;
                const aVal = a[sortState.columnId];
                const bVal = b[sortState.columnId];
                const cmp = this.compareValues(aVal, bVal);
                if (cmp !== 0)
                    return sortState.direction === 'asc' ? cmp : -cmp;
            }
            return 0;
        });
    }
    compareValues(a, b) {
        if (a == null && b == null)
            return 0;
        if (a == null)
            return -1;
        if (b == null)
            return 1;
        if (typeof a === 'number' && typeof b === 'number')
            return a - b;
        if (typeof a === 'boolean' && typeof b === 'boolean')
            return a === b ? 0 : a ? -1 : 1;
        return String(a).localeCompare(String(b));
    }
    // ============================================
    // Grouping
    // ============================================
    getGroupState() { return this.groupState; }
    setGroupBy(columnId) {
        this.groupState = { columnId, direction: 'asc' };
        this.expandedGroups.clear();
        this.processData();
    }
    clearGroup() {
        this.groupState = null;
        this.expandedGroups.clear();
        this.processData();
    }
    toggleGroupDirection() {
        if (!this.groupState)
            return;
        this.groupState.direction = this.groupState.direction === 'asc' ? 'desc' : 'asc';
        this.processData();
    }
    getExpandedGroups() { return new Set(this.expandedGroups); }
    expandGroup(groupKey) { this.expandedGroups.add(groupKey); }
    collapseGroup(groupKey) { this.expandedGroups.delete(groupKey); }
    toggleGroup(groupKey) {
        if (this.expandedGroups.has(groupKey)) {
            this.expandedGroups.delete(groupKey);
        }
        else {
            this.expandedGroups.add(groupKey);
        }
    }
    applyGrouping(data) {
        if (!this.groupState)
            return data;
        // Group by column
        const groups = new Map();
        for (const row of data) {
            const key = String(row[this.groupState.columnId] ?? '');
            if (!groups.has(key))
                groups.set(key, []);
            groups.get(key).push(row);
        }
        // Sort groups
        const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
            const cmp = a.localeCompare(b);
            return this.groupState.direction === 'asc' ? cmp : -cmp;
        });
        // Flatten with group headers
        const result = [];
        for (const key of sortedKeys) {
            const rows = groups.get(key);
            // Add group header row
            result.push({
                _isGroupHeader: true,
                _groupKey: key,
                _groupRowCount: rows.length,
                [this.groupState.columnId]: `${key} (${rows.length})`,
            });
            // Add child rows if expanded
            if (this.expandedGroups.has(key) || this.expandedGroups.size === 0) {
                result.push(...rows);
            }
        }
        return result;
    }
    buildRowIdMap() {
        this.rowIdMap.clear();
        this.originalData.forEach((row, index) => {
            const id = this.getRowId(row);
            this.rowIdMap.set(id, index);
        });
    }
}
export default DataManager;
//# sourceMappingURL=DataManager.js.map