export type CellValue = string | number | boolean | Date | null | undefined;
export interface CellEditor {
    type: 'text' | 'number' | 'date' | 'select' | 'checkbox';
    options?: string[];
    validator?: (value: CellValue) => boolean;
}
export interface ColumnDefinition {
    /** Unique column ID */
    id: string;
    /** Display header text */
    header: string;
    /** Field name in data object */
    field: string;
    /** Column width in pixels */
    width?: number;
    /** Minimum column width */
    minWidth?: number;
    /** Maximum column width */
    maxWidth?: number;
    /** Is column resizable */
    resizable?: boolean;
    /** Is column reorderable */
    reorderable?: boolean;
    /** Column pin position */
    pinned?: 'left' | 'right' | null;
    /** Is column visible */
    visible?: boolean;
    /** Is column sortable */
    sortable?: boolean;
    /** Is column filterable */
    filterable?: boolean;
    /** Column filter type (defaults to 'text') */
    filterType?: 'text' | 'number' | 'date' | 'boolean';
    /** Column data type hint (optional) */
    type?: 'text' | 'number' | 'date' | 'boolean';
    /** Cell editor configuration */
    editor?: CellEditor;
    /** Is cell editable */
    editable?: boolean | ((rowData: RowData) => boolean);
    /** Custom cell renderer */
    renderCell?: (value: CellValue, rowData: RowData, rowIndex: number) => string | HTMLElement;
    /** Custom header renderer */
    renderHeader?: (column: ColumnDefinition) => string | HTMLElement;
    /** Column span (horizontal merge) */
    colSpan?: number;
    /** CSS class for column cells */
    cellClass?: string | string[] | ((rowData: RowData) => string | string[]);
}
export interface RowData {
    [key: string]: CellValue;
}
export type SortDirection = 'asc' | 'desc' | null;
export interface SortState {
    columnId: string;
    direction: SortDirection;
}
export interface FilterState {
    columnId: string;
    type: 'text' | 'number' | 'date' | 'set' | 'boolean';
    value: CellValue | CellValue[];
    operator?: 'contains' | 'notContains' | 'equals' | 'notEquals' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual' | 'inRange' | 'blank' | 'notBlank' | 'true' | 'false';
}
export type SelectionMode = 'none' | 'single' | 'multiple';
export interface SelectionState {
    mode: SelectionMode;
    selectedRows: Set<string>;
    lastSelectedRow: string | null;
    anchorRow: string | null;
}
export type EditState = {
    editing: boolean;
    rowId: string | null;
    columnId: string | null;
    originalValue: CellValue | null;
};
export interface ScrollPosition {
    scrollTop: number;
    scrollLeft: number;
}
export interface ViewportInfo {
    visibleStartIndex: number;
    visibleEndIndex: number;
    visibleCount: number;
    offsetY: number;
    offsetX: number;
}
export interface GridConfig {
    /** Row height in pixels (default: 48) */
    rowHeight?: number;
    /** Header height in pixels (default: 56) */
    headerHeight?: number;
    /** Number of buffer rows above/below viewport */
    bufferSize?: number;
    /** Auto-height mode for dynamic row heights */
    autoHeight?: boolean;
    /** Selection configuration */
    selection?: {
        mode: SelectionMode;
        checkboxes?: boolean;
    };
    /** Sorting configuration */
    sorting?: {
        multiSort?: boolean;
        defaultSort?: SortState;
    };
    /** Filtering configuration */
    filtering?: {
        enabled?: boolean;
        quickFilter?: boolean;
    };
    /** Editing configuration */
    editing?: {
        enabled?: boolean;
        mode?: 'cell' | 'row';
    };
    /** Pagination configuration */
    pagination?: {
        enabled?: boolean;
        pageSize?: number;
        pageSizes?: number[];
    };
}
export interface GridEvents {
    onScroll?: (position: ScrollPosition) => void;
    onSort?: (sortState: SortState[]) => void;
    onFilter?: (filterState: FilterState[]) => void;
    onSelect?: (selectedIds: string[]) => void;
    onEdit?: (rowId: string, columnId: string, value: CellValue) => void;
    onCellEditStart?: (rowId: string, columnId: string) => void;
    onCellEditEnd?: (rowId: string, columnId: string, value: CellValue, cancelled: boolean) => void;
    onRowClick?: (rowId: string, rowData: RowData) => void;
    onRowDoubleClick?: (rowId: string, rowData: RowData) => void;
}
export interface DataGridInstance {
    /** Get current data */
    getData(): RowData[];
    /** Set new data */
    setData(data: RowData[]): void;
    /** Get row by ID */
    getRow(rowId: string): RowData | null;
    /** Insert row at index */
    insertRow(index: number, row: RowData): void;
    /** Delete row by ID */
    deleteRow(rowId: string): void;
    /** Update row by ID */
    updateRow(rowId: string, data: Partial<RowData>): void;
    /** Batch operations (insert, delete, update multiple rows) */
    batch(operations: BatchOperation[]): void;
    /** Check if undo is available */
    canUndo(): boolean;
    /** Check if redo is available */
    canRedo(): boolean;
    /** Undo last operation */
    undo(): boolean;
    /** Redo last undone operation */
    redo(): boolean;
    /** Get selected rows */
    getSelectedRows(): RowData[];
    /** Clear selection */
    clearSelection(): void;
    /** Get sort state */
    getSortState(): SortState[];
    /** Set sort state */
    setSortState(state: SortState[]): void;
    /** Get filter state */
    getFilterState(): FilterState[];
    /** Set filter state */
    setFilterState(state: FilterState[]): void;
    /** Refresh grid */
    refresh(): void;
    /** Destroy grid */
    destroy(): void;
    /** Scroll to row */
    scrollToRow(rowId: string): void;
    /** Export to CSV */
    exportToCSV(): string;
    /** Get scroll position */
    getScrollPosition(): ScrollPosition;
}
export type BatchOperation = {
    type: 'insert' | 'delete' | 'update';
    rowId?: string;
    index?: number;
    data?: RowData;
    previousData?: RowData;
};
export type DataGridOptions = GridConfig & GridEvents;
//# sourceMappingURL=grid.d.ts.map