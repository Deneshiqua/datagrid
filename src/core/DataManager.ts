// ============================================
// DataManager - Data CRUD, Sorting, Filtering + Undo/Redo
// ============================================

import { RowData, SortState, FilterState, CellValue } from '../types/grid';

export interface BatchOperation {
  type: 'insert' | 'delete' | 'update';
  rowId?: string;
  index?: number;
  data?: RowData;
  previousData?: RowData;
}

export interface DataManagerOptions {
  idField: string;
  sortable: boolean;
  filterable: boolean;
}

export class DataManager {
  private originalData: RowData[] = [];
  private processedData: RowData[] = [];
  private options: DataManagerOptions;
  private sortStates: SortState[] = [];
  private filterStates: FilterState[] = [];
  private quickFilterValue: string = '';
  private rowIdMap: Map<string, number> = new Map();

  // Undo/Redo stacks
  private undoStack: BatchOperation[][] = [];
  private redoStack: BatchOperation[][] = [];
  private maxHistorySize: number = 50;

  // Change listeners
  private listeners: Set<() => void> = new Set();

  constructor(options: Partial<DataManagerOptions> = {}) {
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

  setData(data: RowData[]): void {
    this.originalData = [...data];
    this.buildRowIdMap();
    this.processData();
    this.clearHistory();
  }

  getData(): RowData[] {
    return [...this.processedData];
  }

  getOriginalData(): RowData[] {
    return [...this.originalData];
  }

  getRowCount(): number {
    return this.processedData.length;
  }

  getRowAt(index: number): RowData | null {
    if (index < 0 || index >= this.processedData.length) return null;
    return { ...this.processedData[index] };
  }

  getRowById(id: string): RowData | null {
    const index = this.rowIdMap.get(id);
    if (index === undefined) return null;
    return this.getRowAt(index);
  }

  getRowId(rowData: RowData): string {
    const id = rowData[this.options.idField];
    return id !== undefined && id !== null ? String(id) : Math.random().toString(36).substr(2, 9);
  }

  // ============================================
  // CRUD Operations (with Undo/Redo)
  // ============================================

  insertRow(index: number, row: RowData, recordHistory: boolean = true): void {
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

  deleteRow(id: string, recordHistory: boolean = true): boolean {
    const index = this.rowIdMap.get(id);
    if (index === undefined) return false;

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

  updateRow(id: string, data: Partial<RowData>, recordHistory: boolean = true): boolean {
    const index = this.rowIdMap.get(id);
    if (index === undefined) return false;

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

  batch(operations: BatchOperation[], recordHistory: boolean = true): void {
    if (operations.length === 0) return;

    const undoOps: BatchOperation[] = [];

    // Apply all operations
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

  private applyOperation(op: BatchOperation, recordHistory: boolean = true): BatchOperation | null {
    switch (op.type) {
      case 'insert':
        if (op.index !== undefined && op.data) {
          this.originalData.splice(op.index, 0, { ...op.data });
          return recordHistory ? { type: 'delete', rowId: op.data[this.options.idField] as string } : null;
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

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): boolean {
    if (!this.canUndo()) return false;

    const ops = this.undoStack.pop()!;
    const reverseOps: BatchOperation[] = [];

    // Apply reverse operations (in reverse order)
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

  redo(): boolean {
    if (!this.canRedo()) return false;

    const ops = this.redoStack.pop()!;

    for (const op of ops) {
      this.applyOperation(op, false);
    }

    this.undoStack.push(ops);
    this.buildRowIdMap();
    this.processData();
    this.notifyListeners();
    return true;
  }

  private pushUndo(ops: BatchOperation[]): void {
    this.undoStack.push(ops);
    this.redoStack = []; // Clear redo on new action
    
    // Limit history size
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift();
    }
  }

  clearHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  getHistorySize(): { undo: number; redo: number } {
    return {
      undo: this.undoStack.length,
      redo: this.redoStack.length,
    };
  }

  // ============================================
  // Change Listeners
  // ============================================

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  // ============================================
  // Sorting
  // ============================================

  getSortState(): SortState[] {
    return [...this.sortStates];
  }

  setSortState(states: SortState[]): void {
    this.sortStates = [...states];
    this.processData();
    this.notifyListeners();
  }

  addSortState(columnId: string, direction: 'asc' | 'desc'): void {
    const existingIndex = this.sortStates.findIndex(s => s.columnId === columnId);
    if (existingIndex >= 0) {
      this.sortStates[existingIndex].direction = direction;
    } else {
      this.sortStates.push({ columnId, direction });
    }
    this.processData();
    this.notifyListeners();
  }

  clearSortState(): void {
    this.sortStates = [];
    this.processData();
    this.notifyListeners();
  }

  // ============================================
  // Filtering
  // ============================================

  getFilterState(): FilterState[] {
    return [...this.filterStates];
  }

  setFilterState(states: FilterState[]): void {
    this.filterStates = [...states];
    this.processData();
    this.notifyListeners();
  }

  setQuickFilter(value: string): void {
    this.quickFilterValue = value.toLowerCase().trim();
    this.processData();
    this.notifyListeners();
  }

  clearFilters(): void {
    this.filterStates = [];
    this.quickFilterValue = '';
    this.processData();
    this.notifyListeners();
  }

  // ============================================
  // Private Methods
  // ============================================

  private processData(): void {
    let result = [...this.originalData];

    if (this.filterStates.length > 0 || this.quickFilterValue) {
      result = this.applyFilters(result);
    }

    if (this.sortStates.length > 0) {
      result = this.applySorting(result);
    }

    this.processedData = result;
  }

  private applyFilters(data: RowData[]): RowData[] {
    return data.filter(row => {
      for (const filter of this.filterStates) {
        if (!this.matchesFilter(row, filter)) return false;
      }
      if (this.quickFilterValue) {
        const values = Object.values(row).join(' ').toLowerCase();
        if (!values.includes(this.quickFilterValue)) return false;
      }
      return true;
    });
  }

  private matchesFilter(row: RowData, filter: FilterState): boolean {
    const value = row[filter.columnId];
    switch (filter.type) {
      case 'text': return this.matchesTextFilter(value, filter);
      case 'number': return this.matchesNumberFilter(value, filter);
      case 'boolean': return Boolean(value) === Boolean(filter.value);
      case 'set': return Array.isArray(filter.value) && (filter.value as CellValue[]).includes(value);
      default: return true;
    }
  }

  private matchesTextFilter(value: CellValue, filter: FilterState): boolean {
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

  private matchesNumberFilter(value: CellValue, filter: FilterState): boolean {
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

  private applySorting(data: RowData[]): RowData[] {
    return [...data].sort((a, b) => {
      for (const sortState of this.sortStates) {
        if (sortState.direction === null) continue;
        const aVal = a[sortState.columnId];
        const bVal = b[sortState.columnId];
        const cmp = this.compareValues(aVal, bVal);
        if (cmp !== 0) return sortState.direction === 'asc' ? cmp : -cmp;
      }
      return 0;
    });
  }

  private compareValues(a: CellValue, b: CellValue): number {
    if (a == null && b == null) return 0;
    if (a == null) return -1;
    if (b == null) return 1;
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    if (typeof a === 'boolean' && typeof b === 'boolean') return a === b ? 0 : a ? -1 : 1;
    return String(a).localeCompare(String(b));
  }

  private buildRowIdMap(): void {
    this.rowIdMap.clear();
    this.originalData.forEach((row, index) => {
      const id = this.getRowId(row);
      this.rowIdMap.set(id, index);
    });
  }
}

export default DataManager;
