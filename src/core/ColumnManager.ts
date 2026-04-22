// ============================================
// ColumnManager - Column State & Operations
// Handles resize, reorder, pin, hide/show
// ============================================

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

export class ColumnManager {
  private columns: Map<string, ColumnDefinition> = new Map();
  private columnOrder: string[] = [];
  private columnStates: Map<string, ColumnState> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor(columns: ColumnDefinition[] = []) {
    columns.forEach(col => this.addColumn(col));
  }

  // ============================================
  // Column CRUD
  // ============================================

  addColumn(col: ColumnDefinition): void {
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

  getColumn(id: string): ColumnDefinition | undefined {
    return this.columns.get(id);
  }

  getColumns(): ColumnDefinition[] {
    return this.getColumnsInOrder();
  }

  getColumnsInOrder(): ColumnDefinition[] {
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
      .map(id => this.columns.get(id)!)
      .filter(Boolean);
  }

  getVisibleColumns(): ColumnDefinition[] {
    return this.getColumnsInOrder().filter(col => this.isColumnVisible(col.id));
  }

  updateColumn(id: string, updates: Partial<ColumnDefinition>): void {
    const col = this.columns.get(id);
    if (col) {
      this.columns.set(id, { ...col, ...updates });
      this.notifyListeners();
    }
  }

  deleteColumn(id: string): void {
    this.columns.delete(id);
    this.columnStates.delete(id);
    this.columnOrder = this.columnOrder.filter(colId => colId !== id);
    this.notifyListeners();
  }

  // ============================================
  // Column State Operations
  // ============================================

  isColumnVisible(id: string): boolean {
    return this.columnStates.get(id)?.visible ?? true;
  }

  setColumnVisible(id: string, visible: boolean): void {
    const state = this.columnStates.get(id);
    if (state) {
      state.visible = visible;
      this.notifyListeners();
    }
  }

  toggleColumnVisibility(id: string): void {
    const state = this.columnStates.get(id);
    if (state) {
      state.visible = !state.visible;
      this.notifyListeners();
    }
  }

  // ============================================
  // Column Sizing
  // ============================================

  getColumnWidth(id: string): number {
    return this.columnStates.get(id)?.width || 100;
  }

  setColumnWidth(id: string, width: number): void {
    const state = this.columnStates.get(id);
    if (state) {
      state.width = Math.max(state.minWidth, Math.min(state.maxWidth, width));
      this.notifyListeners();
    }
  }

  getColumnMinWidth(id: string): number {
    return this.columnStates.get(id)?.minWidth || 50;
  }

  getColumnMaxWidth(id: string): number {
    return this.columnStates.get(id)?.maxWidth || 1000;
  }

  // ============================================
  // Column Reorder
  // ============================================

  moveColumn(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || toIndex < 0) return;
    if (fromIndex >= this.columnOrder.length || toIndex >= this.columnOrder.length) return;

    const item = this.columnOrder.splice(fromIndex, 1)[0];
    this.columnOrder.splice(toIndex, 0, item);
    
    // Update order values
    this.columnOrder.forEach((id, idx) => {
      const state = this.columnStates.get(id);
      if (state) state.order = idx;
    });
    
    this.notifyListeners();
  }

  getColumnIndex(id: string): number {
    return this.columnOrder.indexOf(id);
  }

  reorderColumns(newOrder: string[]): void {
    // Validate new order
    if (newOrder.length !== this.columnOrder.length) return;
    if (!newOrder.every(id => this.columnOrder.includes(id))) return;
    
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

  getColumnPin(id: string): ColumnPinPosition {
    return this.columnStates.get(id)?.pinned || null;
  }

  setColumnPin(id: string, position: ColumnPinPosition): void {
    const state = this.columnStates.get(id);
    if (state) {
      state.pinned = position;
      this.notifyListeners();
    }
  }

  pinColumnLeft(id: string): void {
    this.setColumnPin(id, 'left');
  }

  pinColumnRight(id: string): void {
    this.setColumnPin(id, 'right');
  }

  unpinColumn(id: string): void {
    this.setColumnPin(id, null);
  }

  toggleColumnPin(id: string): void {
    const current = this.getColumnPin(id);
    if (current === 'left') {
      this.setColumnPin(id, 'right');
    } else if (current === 'right') {
      this.setColumnPin(id, null);
    } else {
      this.setColumnPin(id, 'left');
    }
  }

  // ============================================
  // Listeners
  // ============================================

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  // ============================================
  // Serialization (for save/restore)
  // ============================================

  getState(): Record<string, ColumnState> {
    const state: Record<string, ColumnState> = {};
    this.columnStates.forEach((s, id) => {
      state[id] = { ...s };
    });
    return state;
  }

  setState(state: Record<string, ColumnState>): void {
    state && Object.entries(state).forEach(([id, s]) => {
      if (this.columnStates.has(id)) {
        this.columnStates.set(id, { ...s });
      }
    });
    this.notifyListeners();
  }
}

export default ColumnManager;
