// Entry point for browser - pure side-effect, assigns DataGrid to globalThis
import { DataGrid } from './core/DataGrid';

// Assign to both window and globalThis for maximum compatibility
if (typeof globalThis !== 'undefined') {
  (globalThis as any).DataGrid = DataGrid;
}
if (typeof window !== 'undefined') {
  (window as any).DataGrid = DataGrid;
}
