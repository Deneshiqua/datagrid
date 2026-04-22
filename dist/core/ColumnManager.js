// ============================================
// ColumnManager - Column State & Operations
// Handles resize, reorder, pin, hide/show
// ============================================
export class ColumnManager {
    constructor(columns = []) {
        this.columns = new Map();
        this.columnOrder = [];
        this.columnStates = new Map();
        this.listeners = new Set();
        columns.forEach(col => this.addColumn(col));
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
            maxWidth: col.maxWidth || 1000,
            visible: col.visible !== false,
            pinned: col.pinned || null,
            order: this.columnOrder.length - 1,
        });
    }
    getColumn(id) {
        return this.columns.get(id);
    }
    getColumns() {
        return this.getColumnsInOrder();
    }
    getColumnsInOrder() {
        const pinnedLeft = this.columnOrder
            .filter(id => this.columnStates.get(id)?.pinned === 'left')
            .sort((a, b) => (this.columnStates.get(a)?.order || 0) - (this.columnStates.get(b)?.order || 0));
        const unpinned = this.columnOrder
            .filter(id => !this.columnStates.get(id)?.pinned)
            .sort((a, b) => (this.columnStates.get(a)?.order || 0) - (this.columnStates.get(b)?.order || 0));
        const pinnedRight = this.columnOrder
            .filter(id => this.columnStates.get(id)?.pinned === 'right')
            .sort((a, b) => (this.columnStates.get(a)?.order || 0) - (this.columnStates.get(b)?.order || 0));
        return [...pinnedLeft, ...unpinned, ...pinnedRight]
            .map(id => this.columns.get(id))
            .filter(Boolean);
    }
    getVisibleColumns() {
        return this.getColumnsInOrder().filter(col => this.isColumnVisible(col.id));
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
        this.columnOrder = this.columnOrder.filter(colId => colId !== id);
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
        return this.columnStates.get(id)?.maxWidth || 1000;
    }
    // ============================================
    // Column Reorder
    // ============================================
    moveColumn(fromIndex, toIndex) {
        if (fromIndex === toIndex)
            return;
        if (fromIndex < 0 || toIndex < 0)
            return;
        if (fromIndex >= this.columnOrder.length || toIndex >= this.columnOrder.length)
            return;
        const item = this.columnOrder.splice(fromIndex, 1)[0];
        this.columnOrder.splice(toIndex, 0, item);
        // Update order values
        this.columnOrder.forEach((id, idx) => {
            const state = this.columnStates.get(id);
            if (state)
                state.order = idx;
        });
        this.notifyListeners();
    }
    getColumnIndex(id) {
        return this.columnOrder.indexOf(id);
    }
    reorderColumns(newOrder) {
        // Validate new order
        if (newOrder.length !== this.columnOrder.length)
            return;
        if (!newOrder.every(id => this.columnOrder.includes(id)))
            return;
        this.columnOrder = [...newOrder];
        this.columnOrder.forEach((id, idx) => {
            const state = this.columnStates.get(id);
            if (state)
                state.order = idx;
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
        this.setColumnPin(id, 'left');
    }
    pinColumnRight(id) {
        this.setColumnPin(id, 'right');
    }
    unpinColumn(id) {
        this.setColumnPin(id, null);
    }
    toggleColumnPin(id) {
        const current = this.getColumnPin(id);
        if (current === 'left') {
            this.setColumnPin(id, 'right');
        }
        else if (current === 'right') {
            this.setColumnPin(id, null);
        }
        else {
            this.setColumnPin(id, 'left');
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
        this.listeners.forEach(listener => listener());
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
}
export default ColumnManager;
//# sourceMappingURL=ColumnManager.js.map