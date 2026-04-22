import { ColumnDefinition } from '../types/grid';
export type ColumnPinPosition = 'left' | 'right' | null;
export interface ColumnState {
    width: number;
    minWidth: number;
    maxWidth: number;
    visible: boolean;
    pinned: ColumnPinPosition;
    order: number;
}
export declare class ColumnManager {
    private columns;
    private columnOrder;
    private columnStates;
    private listeners;
    constructor(columns?: ColumnDefinition[]);
    addColumn(col: ColumnDefinition): void;
    getColumn(id: string): ColumnDefinition | undefined;
    getColumns(): ColumnDefinition[];
    getColumnsInOrder(): ColumnDefinition[];
    getVisibleColumns(): ColumnDefinition[];
    updateColumn(id: string, updates: Partial<ColumnDefinition>): void;
    deleteColumn(id: string): void;
    isColumnVisible(id: string): boolean;
    setColumnVisible(id: string, visible: boolean): void;
    toggleColumnVisibility(id: string): void;
    getColumnWidth(id: string): number;
    setColumnWidth(id: string, width: number): void;
    getColumnMinWidth(id: string): number;
    getColumnMaxWidth(id: string): number;
    moveColumn(fromIndex: number, toIndex: number): void;
    getColumnIndex(id: string): number;
    reorderColumns(newOrder: string[]): void;
    getColumnPin(id: string): ColumnPinPosition;
    setColumnPin(id: string, position: ColumnPinPosition): void;
    pinColumnLeft(id: string): void;
    pinColumnRight(id: string): void;
    unpinColumn(id: string): void;
    toggleColumnPin(id: string): void;
    onChange(listener: () => void): () => void;
    private notifyListeners;
    getState(): Record<string, ColumnState>;
    setState(state: Record<string, ColumnState>): void;
}
export default ColumnManager;
//# sourceMappingURL=ColumnManager.d.ts.map