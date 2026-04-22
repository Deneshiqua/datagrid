import { RowData, SortState, FilterState } from '../types/grid';
export interface DataManagerOptions {
    /** Unique ID field name */
    idField: string;
    /** Enable sorting */
    sortable: boolean;
    /** Enable filtering */
    filterable: boolean;
}
export declare class DataManager {
    private originalData;
    private processedData;
    private options;
    private sortStates;
    private filterStates;
    private quickFilterValue;
    private rowIdMap;
    constructor(options?: Partial<DataManagerOptions>);
    /**
     * Set data and rebuild index
     */
    setData(data: RowData[]): void;
    /**
     * Get all processed data
     */
    getData(): RowData[];
    /**
     * Get original (unprocessed) data
     */
    getOriginalData(): RowData[];
    /**
     * Get row count
     */
    getRowCount(): number;
    /**
     * Get row by index
     */
    getRowAt(index: number): RowData | null;
    /**
     * Get row by ID
     */
    getRowById(id: string): RowData | null;
    /**
     * Get row ID
     */
    getRowId(rowData: RowData): string;
    /**
     * Insert row at index
     */
    insertRow(index: number, row: RowData): void;
    /**
     * Delete row by ID
     */
    deleteRow(id: string): void;
    /**
     * Update row by ID
     */
    updateRow(id: string, data: Partial<RowData>): void;
    /**
     * Get sort state
     */
    getSortState(): SortState[];
    /**
     * Set sort state
     */
    setSortState(states: SortState[]): void;
    /**
     * Add single sort state
     */
    addSortState(columnId: string, direction: 'asc' | 'desc'): void;
    /**
     * Clear sort state
     */
    clearSortState(): void;
    /**
     * Get filter state
     */
    getFilterState(): FilterState[];
    /**
     * Set filter state
     */
    setFilterState(states: FilterState[]): void;
    /**
     * Set quick filter (search across all columns)
     */
    setQuickFilter(value: string): void;
    /**
     * Clear all filters
     */
    clearFilters(): void;
    /**
     * Process data: filter -> sort -> return
     */
    private processData;
    /**
     * Apply filters to data
     */
    private applyFilters;
    /**
     * Check if row matches a single filter
     */
    private matchesFilter;
    private matchesTextFilter;
    private matchesNumberFilter;
    private matchesBooleanFilter;
    private matchesSetFilter;
    /**
     * Apply sorting to data
     */
    private applySorting;
    /**
     * Compare two values for sorting
     */
    private compareValues;
    /**
     * Build row ID index map
     */
    private buildRowIdMap;
}
export default DataManager;
//# sourceMappingURL=DataManager.d.ts.map