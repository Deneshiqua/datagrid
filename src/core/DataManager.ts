// ============================================
// DataManager - Data CRUD, Sorting & Filtering
// ============================================

import { RowData, SortState, FilterState, CellValue } from '../types/grid';

export interface DataManagerOptions {
  /** Unique ID field name */
  idField: string;
  /** Enable sorting */
  sortable: boolean;
  /** Enable filtering */
  filterable: boolean;
}

export class DataManager {
  private originalData: RowData[] = [];
  private processedData: RowData[] = [];
  private options: DataManagerOptions;
  private sortStates: SortState[] = [];
  private filterStates: FilterState[] = [];
  private quickFilterValue: string = '';
  private rowIdMap: Map<string, number> = new Map(); // id -> index

  constructor(options: Partial<DataManagerOptions> = {}) {
    this.options = {
      idField: 'id',
      sortable: true,
      filterable: true,
      ...options,
    };
  }

  /**
   * Set data and rebuild index
   */
  setData(data: RowData[]): void {
    this.originalData = [...data];
    this.buildRowIdMap();
    this.processData();
  }

  /**
   * Get all processed data
   */
  getData(): RowData[] {
    return [...this.processedData];
  }

  /**
   * Get original (unprocessed) data
   */
  getOriginalData(): RowData[] {
    return [...this.originalData];
  }

  /**
   * Get row count
   */
  getRowCount(): number {
    return this.processedData.length;
  }

  /**
   * Get row by index
   */
  getRowAt(index: number): RowData | null {
    if (index < 0 || index >= this.processedData.length) return null;
    return { ...this.processedData[index] };
  }

  /**
   * Get row by ID
   */
  getRowById(id: string): RowData | null {
    const index = this.rowIdMap.get(id);
    if (index === undefined) return null;
    return this.getRowAt(index);
  }

  /**
   * Get row ID
   */
  getRowId(rowData: RowData): string {
    const id = rowData[this.options.idField];
    return id !== undefined && id !== null ? String(id) : Math.random().toString(36).substr(2, 9);
  }

  /**
   * Insert row at index
   */
  insertRow(index: number, row: RowData): void {
    const insertIndex = Math.max(0, Math.min(index, this.originalData.length));
    this.originalData.splice(insertIndex, 0, { ...row });
    this.buildRowIdMap();
    this.processData();
  }

  /**
   * Delete row by ID
   */
  deleteRow(id: string): void {
    const index = this.rowIdMap.get(id);
    if (index !== undefined) {
      this.originalData.splice(index, 1);
      this.buildRowIdMap();
      this.processData();
    }
  }

  /**
   * Update row by ID
   */
  updateRow(id: string, data: Partial<RowData>): void {
    const index = this.rowIdMap.get(id);
    if (index !== undefined) {
      this.originalData[index] = { ...this.originalData[index], ...data };
      this.buildRowIdMap();
      this.processData();
    }
  }

  /**
   * Get sort state
   */
  getSortState(): SortState[] {
    return [...this.sortStates];
  }

  /**
   * Set sort state
   */
  setSortState(states: SortState[]): void {
    this.sortStates = [...states];
    this.processData();
  }

  /**
   * Add single sort state
   */
  addSortState(columnId: string, direction: 'asc' | 'desc'): void {
    const existingIndex = this.sortStates.findIndex(s => s.columnId === columnId);
    if (existingIndex >= 0) {
      this.sortStates[existingIndex].direction = direction;
    } else {
      this.sortStates.push({ columnId, direction });
    }
    this.processData();
  }

  /**
   * Clear sort state
   */
  clearSortState(): void {
    this.sortStates = [];
    this.processData();
  }

  /**
   * Get filter state
   */
  getFilterState(): FilterState[] {
    return [...this.filterStates];
  }

  /**
   * Set filter state
   */
  setFilterState(states: FilterState[]): void {
    this.filterStates = [...states];
    this.processData();
  }

  /**
   * Set quick filter (search across all columns)
   */
  setQuickFilter(value: string): void {
    this.quickFilterValue = value.toLowerCase().trim();
    this.processData();
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.filterStates = [];
    this.quickFilterValue = '';
    this.processData();
  }

  /**
   * Process data: filter -> sort -> return
   */
  private processData(): void {
    let result = [...this.originalData];

    // Apply filters
    if (this.filterStates.length > 0 || this.quickFilterValue) {
      result = this.applyFilters(result);
    }

    // Apply sorting
    if (this.sortStates.length > 0) {
      result = this.applySorting(result);
    }

    this.processedData = result;
  }

  /**
   * Apply filters to data
   */
  private applyFilters(data: RowData[]): RowData[] {
    return data.filter(row => {
      // Check column filters
      for (const filter of this.filterStates) {
        if (!this.matchesFilter(row, filter)) {
          return false;
        }
      }

      // Check quick filter
      if (this.quickFilterValue) {
        const values = Object.values(row).join(' ').toLowerCase();
        if (!values.includes(this.quickFilterValue)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Check if row matches a single filter
   */
  private matchesFilter(row: RowData, filter: FilterState): boolean {
    const value = row[filter.columnId];
    
    switch (filter.type) {
      case 'text':
        return this.matchesTextFilter(value, filter);
      case 'number':
        return this.matchesNumberFilter(value, filter);
      case 'boolean':
        return this.matchesBooleanFilter(value, filter);
      case 'set':
        return this.matchesSetFilter(value, filter);
      default:
        return true;
    }
  }

  private matchesTextFilter(value: CellValue, filter: FilterState): boolean {
    const strValue = String(value || '').toLowerCase();
    const filterValue = String(filter.value || '').toLowerCase();
    const operator = filter.operator || 'contains';

    switch (operator) {
      case 'equals':
        return strValue === filterValue;
      case 'startsWith':
        return strValue.startsWith(filterValue);
      case 'endsWith':
        return strValue.endsWith(filterValue);
      case 'contains':
      default:
        return strValue.includes(filterValue);
    }
  }

  private matchesNumberFilter(value: CellValue, filter: FilterState): boolean {
    const numValue = Number(value);
    const filterValue = Number(filter.value);
    const operator = filter.operator || 'equals';

    switch (operator) {
      case 'greaterThan':
        return numValue > filterValue;
      case 'lessThan':
        return numValue < filterValue;
      case 'inRange':
        if (Array.isArray(filter.value) && filter.value.length >= 2) {
          return numValue >= Number(filter.value[0]) && numValue <= Number(filter.value[1]);
        }
        return false;
      case 'equals':
      default:
        return numValue === filterValue;
    }
  }

  private matchesBooleanFilter(value: CellValue, filter: FilterState): boolean {
    return Boolean(value) === Boolean(filter.value);
  }

  private matchesSetFilter(value: CellValue, filter: FilterState): boolean {
    if (!Array.isArray(filter.value)) return true;
    return (filter.value as CellValue[]).includes(value);
  }

  /**
   * Apply sorting to data
   */
  private applySorting(data: RowData[]): RowData[] {
    return [...data].sort((a, b) => {
      for (const sortState of this.sortStates) {
        if (sortState.direction === null) continue;

        const aVal = a[sortState.columnId];
        const bVal = b[sortState.columnId];
        const comparison = this.compareValues(aVal, bVal);
        
        if (comparison !== 0) {
          return sortState.direction === 'asc' ? comparison : -comparison;
        }
      }
      return 0;
    });
  }

  /**
   * Compare two values for sorting
   */
  private compareValues(a: CellValue, b: CellValue): number {
    // Handle null/undefined
    if (a == null && b == null) return 0;
    if (a == null) return -1;
    if (b == null) return 1;

    // Compare numbers
    if (typeof a === 'number' && typeof b === 'number') {
      return a - b;
    }

    // Compare dates
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() - b.getDate();
    }

    // Compare booleans (true before false)
    if (typeof a === 'boolean' && typeof b === 'boolean') {
      return a === b ? 0 : a ? -1 : 1;
    }

    // Compare strings
    return String(a).localeCompare(String(b));
  }

  /**
   * Build row ID index map
   */
  private buildRowIdMap(): void {
    this.rowIdMap.clear();
    this.originalData.forEach((row, index) => {
      const id = this.getRowId(row);
      this.rowIdMap.set(id, index);
    });
  }
}

export default DataManager;
