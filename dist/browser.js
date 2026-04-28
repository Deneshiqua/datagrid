// Entry point for browser - pure side-effect, assigns DataGrid to globalThis
import { DataGrid } from './core/DataGrid';
// Assign to both window and globalThis for maximum compatibility
if (typeof globalThis !== 'undefined') {
    globalThis.DataGrid = DataGrid;
}
if (typeof window !== 'undefined') {
    window.DataGrid = DataGrid;
}
//# sourceMappingURL=browser.js.map