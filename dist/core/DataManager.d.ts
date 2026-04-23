import { RowData, SortState, FilterState } from '../types/grid';
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
export declare class DataManager {
    private originalData;
    private processedData;
    private options;
    private sortStates;
    private filterStates;
    private quickFilterValue;
    private rowIdMap;
    private undoStack;
    private redoStack;
    private maxHistorySize;
    private listeners;
    private groupState;
    private expandedGroups;
    constructor(options?: Partial<DataManagerOptions>);
    setData(data: RowData[]): void;
    getData(): RowData[];
    getOriginalData(): RowData[];
    getRowCount(): number;
    getRowAt(index: number): RowData | null;
    getRowById(id: string): RowData | null;
    getRowId(rowData: RowData): string;
    insertRow(index: number, row: RowData, recordHistory?: boolean): void;
    deleteRow(id: string, recordHistory?: boolean): boolean;
    updateRow(id: string, data: Partial<RowData>, recordHistory?: boolean): boolean;
    batch(operations: BatchOperation[], recordHistory?: boolean): void;
    private applyOperation;
    canUndo(): boolean;
    canRedo(): boolean;
    undo(): boolean;
    redo(): boolean;
    private pushUndo;
    clearHistory(): void;
    getHistorySize(): {
        undo: number;
        redo: number;
    };
    onChange(listener: () => void): () => void;
    private notifyListeners;
    getSortState(): SortState[];
    setSortState(states: SortState[]): void;
    addSortState(columnId: string, direction: 'asc' | 'desc'): void;
    clearSortState(): void;
    getFilterState(): FilterState[];
    setFilterState(states: FilterState[]): void;
    setQuickFilter(value: string): void;
    clearFilters(): void;
    private processData;
    private applyFilters;
    private matchesFilter;
    private matchesTextFilter;
    private matchesNumberFilter;
    private applySorting;
    private compareValues;
    getGroupState(): {
        columnId: string;
        direction: 'asc' | 'desc';
    } | null;
    setGroupBy(columnId: string): void;
    clearGroup(): void;
    toggleGroupDirection(): void;
    getExpandedGroups(): Set<string>;
    expandGroup(groupKey: string): void;
    collapseGroup(groupKey: string): void;
    toggleGroup(groupKey: string): void;
    private applyGrouping;
    private buildRowIdMap;
}
export default DataManager;
//# sourceMappingURL=DataManager.d.ts.map