// Entry point for browser - assigns DataGrid to window
import { DataGrid } from './core/DataGrid';

// Attach to window IMMEDIATELY when script loads
(window as any).DataGrid = DataGrid;

// Also export for ESM compatibility (won't affect IIFE)
export { DataGrid };
