# DataGrid Framework - Roadmap

## Proje Özeti
AG Grid'e alternatif, yüksek performanslı, özellikaçık bir data grid kütüphanesi. Hedef: Virtual scrolling, inline editing, sıralama, filtreleme, gruplama, export/import ve daha fazlası.

---

## PHASE 1: Core Engine (MVP)

### Epic 1: Virtual Scrolling Engine
**Hedef:** 100k+ satır performansı

#### Tasks:
1. [ ] Virtual scroll container oluştur
2. [ ] Row virtualization - sadece görünür satırları render et
3. [ ] Dynamic row height desteği
4. [ ] Smooth scroll performansı
5. [ ] Scroll position restoration
6. [ ] Overflow handling (horizontal & vertical)
7. [ ] Buffer zone (render ahead/behind)

#### Eğitim Konuları:
- RequestAnimationFrame kullanımı
- Intersection Observer
- CSS contain/layout paint

---

### Epic 2: Data Management
**Hedef:** Veri CRUD operasyonları

#### Tasks:
1. [ ] Row model (data structure)
2. [ ] getRowId callback
3. [ ] Row insertion (API + UI)
4. [ ] Row deletion (API + UI)
5. [ ] Row update (API + UI)
6. [ ] Batch operations (transactions)
7. [ ] Undo/Redo stack
8. [ ] Data change events
9. [ ] Immutable data handling

---

### Epic 3: Column System
**Hedef:** Kolon yönetimi

#### Tasks:
1. [ ] Column definition schema
2. [ ] Column sizing (width, minWidth, maxWidth)
3. [ ] Column resize (drag)
4. [ ] Column reorder (drag)
5. [ ] Column pin (left/right/none)
6. [ ] Column hide/show
7. [ ] Column virtualisation
8. [ ] Column spanning
9. [ ] Column groups (header grouping)

---

## PHASE 2: Sorting & Filtering

### Epic 4: Multi-Column Sorting
**Hedef:** Excel benzeri sıralama

#### Tasks:
1. [ ] Sort state management
2. [ ] Single column sort
3. [ ] Multi-column sort (shift+click)
4. [ ] Sort icons (asc/desc/none)
5. [ ] Sort click handlers
6. [ ] Custom comparator desteği
7. [ ] Server-side sorting (API hook)
8. [ ] Sort animations

---

### Epic 5: Filtering System
**Hedef:** Gelişmiş filtreleme

#### Tasks:
1. [ ] Filter framework
2. [ ] Text filter (contains, starts with, ends with, equals)
3. [ ] Number filter (equals, greater than, less than, in range)
4. [ ] Date filter (date range picker)
5. [ ] Set filter (multi-select dropdown)
6. [ ] Boolean filter (checkbox)
7. [ ] Filter builder UI
8. [ ] Filter clear all
9. [ ] Filter presets (save/load)
10. [ ] Server-side filtering (API hook)
11. [ ] Quick filter (search across all columns)

---

## PHASE 3: Selection & Editing

### Epic 6: Row Selection
**Hedef:** Excel benzeri seçim

#### Tasks:
1. [ ] Single row selection
2. [ ] Multi-row selection (Ctrl/Shift)
3. [ ] Checkbox selection
4. [ ] Select all (header checkbox)
5. [ ] Range selection (shift+click)
6. [ ] Selection API (getSelectedRows, etc.)
7. [ ] Selection events
8. [ ] Selection persistence

---

### Epic 7: Inline Editing
**Hedef:** Hücre içinde düzenleme

#### Tasks:
1. [ ] Cell editor framework
2. [ ] Text editor
3. [ ] Number editor (validation)
4. [ ] Date editor
5. [ ] Select/Dropdown editor
6. [ ] Editor events (onCellEdit, onCellEditCancel)
7. [ ] Editable flag per column/row
8. [ ] Cell validation & error display
9. [ ] Edit mode trigger (click/dblclick/enter)
10. [ ] Tab navigation between cells
11. [ ] Escape to cancel

---

## PHASE 4: Advanced Features

### Epic 8: Row Grouping
**Hedef:** Gruplama ve aggregation

#### Tasks:
1. [ ] Group by column
2. [ ] Multi-level grouping
3. [ ] Group row expansion/collapse
4. [ ] Group aggregation (sum, avg, count, min, max)
5. [ ] Custom aggregators
6. [ ] Group order change (drag)
7. [ ] Group expand/collapse API
8. [ ] Group header rendering

---

### Epic 9: Master-Detail View
**Hedef:** Nested grid

#### Tasks:
1. [ ] Detail row template
2. [ ] Lazy loading detail rows
3. [ ] Master-Detail API
4. [ ] Detail panel rendering
5. [ ] Accordion vs separate modes

---

### Epic 10: Tree Data
**Hedef:** Hiyerarşik veri

#### Tasks:
1. [ ] Tree data structure
2. [ ] Tree node expansion/collapse
3. [ ] Indentation & icons
4. [ ] Tree selection (hierarchical)
5. [ ] Lazy load children
6. [ ] Tree level filtering

---

## PHASE 5: Import/Export

### Epic 11: Excel Export
**Hedef:** XLSX çıktısı

#### Tasks:
1. [ ] Export to CSV
2. [ ] Export to XLSX (Excel format)
3. [ ] Column headers export
4. [ ] Selected rows only export
5. [ ] Custom column mapping
6. [ ] Styled export (colors, fonts)
7. [ ] Large dataset export (streaming)

---

### Epic 12: Clipboard Operations
**Hedef:** Copy/Paste

#### Tasks:
1. [ ] Copy cells to clipboard
2. [ ] Copy with headers
3. [ ] Paste from Excel
4. [ ] Paste validation
5. [ ] Multi-range copy
6. [ ] Cut operation

---

### Epic 13: Excel Import
**Hedef:** XLSX okuma

#### Tasks:
1. [ ] Parse XLSX file
2. [ ] Column mapping UI
3. [ ] Validation on import
4. [ ] Import preview
5. [ ] Large file handling (streaming)

---

## PHASE 6: UI Components

### Epic 14: Context Menu
**Hedef:** Sağ tık menüsü

#### Tasks:
1. [ ] Context menu system
2. [ ] Row context menu
3. [ ] Column header context menu
4. [ ] Cell context menu
5. [ ] Menu item customization
6. [ ] Sub-menus
7. [ ] Menu positioning

---

### Epic 15: Sidebar & Filters
**Hedef:** Sidebar panel

#### Tasks:
1. [ ] Sidebar container
2. [ ] Column filters panel
3. [ ] Tool panel (field list)
4. [ ] Sidebar resize
5. [ ] Sidebar toggle

---

### Epic 16: Pagination
**Hedef:** Sayfa sayısı

#### Tasks:
1. [ ] Pagination UI
2. [ ] Page size selector
3. [ ] Page navigation
4. [ ] Page info display
5. [ ] Server-side pagination hook
6. [ ] Jump to page

---

### Epic 17: Status Bar
**Hedef:** Alt bilgi çubuğu

#### Tasks:
1. [ ] Status bar container
2. [ ] Selection count
3. [ ] Aggregate summary
4. [ ] Custom status panels

---

## PHASE 7: Theming & Accessibility

### Epic 18: Theming System
**Hedef:** CSS custom properties

#### Tasks:
1. [ ] CSS custom properties setup
2. [ ] Light theme
3. [ ] Dark theme
4. [ ] Theme switching (runtime)
5. [ ] Custom theme builder
6. [ ] RTL support
7. [ ] Bootstrap/Material themes

---

### Epic 19: Accessibility
**Hedef:** WCAG uyumluluğu

#### Tasks:
1. [ ] Keyboard navigation
2. [ ] ARIA attributes
3. [ ] Screen reader support
4. [ ] Focus management
5. [ ] High contrast mode

---

### Epic 20: Performance Optimization
**Hedef:** Benchmark hedefleri

#### Tasks:
1. [ ] Render profiling
2. [ ] Memory leak detection
3. [ ] Lazy loading modules
4. [ ] Web Workers for heavy ops
5. [ ] Caching strategies
6. [ ] Stress testing (100k+ rows)

---

## PHASE 8: Developer Experience

### Epic 21: API Design
**Hedef:** Temiz public API

#### Tasks:
1. [ ] TypeScript definitions (full)
2. [ ] API documentation
3. [ ] Event documentation
4. [ ] Method documentation
5. [ ] Breaking change policy

---

### Epic 22: Framework Integration
**Hedef:** Wrapper'lar

#### Tasks:
1. [ ] React wrapper (@datagrid/react)
2. [ ] Vue wrapper (@datagrid/vue)
3. [ ] Angular wrapper (@datagrid/angular)
4. [ ] Svelte wrapper (@datagrid/svelte)
5. [ ] Vanilla JS (core)

---

### Epic 23: Documentation
**Hedef:** kapsamlı docs

#### Tasks:
1. [ ] Getting started guide
2. [ ] API reference
3. [ ] Examples gallery
4. [ ] Migration guides
5. [ ] Performance guide
6. [ ] Video tutorials

---

### Epic 24: Testing & CI/CD
**Hedef:** Güvenilir build

#### Tasks:
1. [ ] Unit tests (Jest)
2. [ ] E2E tests (Playwright)
3. [ ] Visual regression tests
4. [ ] Performance benchmarks
5. [ ] GitHub Actions CI
6. [ ] Bundle size tracking
7. [ ] Semantic versioning
8. [ ] npm publish pipeline

---

## Tahmini Zaman

| Phase | Epics | Weeks |
|-------|-------|-------|
| Phase 1 | 3 | 4-6 |
| Phase 2 | 2 | 3-4 |
| Phase 3 | 2 | 4-6 |
| Phase 4 | 3 | 4-6 |
| Phase 5 | 3 | 4-5 |
| Phase 6 | 4 | 3-4 |
| Phase 7 | 3 | 2-3 |
| Phase 8 | 4 | 4-6 |
| **Total** | **24** | **28-40** |

---

## Azure DevOps Import Format

Board'da takip etmek için Azure DevOps'a import edebilmen için XML/CSV formatında task listesi hazırlayabilirim veya Terraform ile Infrastructure as Code olarak kurabilirim.

---

## Sonraki Adımlar

1. **Tech stack belirle:** TypeScript + vanilla JS, React, Vue?
2. **Scope daralt:** Minimum viable product hangi özelliklerle başlar?
3. **License:** MIT, Apache 2.0, proprietary?
4. **Mono-repo vs single package?**

Önce bunları konuşalım, sonra detaylı implementation plan çıkarabilirim. 🚀