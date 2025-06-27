import React, { useState, useEffect, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { exportToExcel } from '../../utils/excelExport';

export interface TableColumn<T = any> {
  id: string;
  label: string;
  width: number;
  visible: boolean;
  resizable: boolean;
  sortable?: boolean;
  filterable?: boolean;
  filterType?: 'text' | 'select' | 'date' | 'number';
  filterOptions?: Array<{ value: string; label: string }>;
  render: (item: T) => React.ReactNode;
}

export interface TablePreferences {
  columnOrder: string[];
  columnWidths: Record<string, number>;
  columnVisibility: Record<string, boolean>;
}

export interface FilterConfig {
  key: string;
  label: string;
  type: 'select' | 'text' | 'date';
  options?: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}

export interface ColumnFilter {
  columnId: string;
  value: string;
  operator?: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan';
}

export interface ConfigurableTableProps<T = any> {
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  storageKey: string;
  title?: string;
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
  filters?: FilterConfig[];
  columnFilters?: ColumnFilter[];
  onColumnFiltersChange?: (filters: ColumnFilter[]) => void;
  onRowClick?: (item: T) => void;
  onExport?: () => void;
  exportFilename?: string;
  getRowStyle?: (item: T) => React.CSSProperties;
  actions?: Array<{
    label: string;
    icon: React.ReactNode;
    onClick: (item: T) => void;
    className?: string;
    show?: (item: T) => boolean;
  }>;
  bulkActions?: Array<{
    label: string;
    icon: React.ReactNode;
    onClick: (selectedItems: T[]) => void;
    className?: string;
  }>;
  enableSelection?: boolean;
  onSelectionChange?: (selectedItems: T[]) => void;
  emptyState?: React.ReactNode;
  headerActions?: React.ReactNode;
}

const ColumnFilterDropdown: React.FC<{
  column: TableColumn;
  filter: ColumnFilter | undefined;
  onFilterChange: (columnId: string, value: string, operator?: string) => void;
  onClose: () => void;
  data: any[];
}> = ({ column, filter, onFilterChange, onClose, data }) => {
  const [tempValue, setTempValue] = useState(filter?.value || '');
  const [tempOperator, setTempOperator] = useState<string>(filter?.operator || 'contains');

  const getUniqueValues = () => {
    if (column.filterOptions) return column.filterOptions;
    
    const values = new Set<string>();
    data.forEach(item => {
      const value = getNestedValue(item, column.id);
      if (value !== null && value !== undefined && value !== '') {
        values.add(String(value));
      }
    });
    return Array.from(values).sort().map(value => ({ value, label: value }));
  };

  const getNestedValue = (obj: any, path: string) => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  };

  const handleApply = () => {
    onFilterChange(column.id, tempValue, tempOperator);
    onClose();
  };

  const handleClear = () => {
    onFilterChange(column.id, '');
    onClose();
  };

  return (
    <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50 min-w-64">
      <div className="p-3">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Filter by {column.label}
        </div>
        
        {column.filterType === 'select' ? (
          <select
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="">All</option>
            {getUniqueValues().map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <>
            <select
              value={tempOperator}
              onChange={(e) => setTempOperator(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 mb-2"
            >
              <option value="contains">Contains</option>
              <option value="equals">Equals</option>
              <option value="startsWith">Starts with</option>
              <option value="endsWith">Ends with</option>
              {column.filterType === 'number' && (
                <>
                  <option value="greaterThan">Greater than</option>
                  <option value="lessThan">Less than</option>
                </>
              )}
            </select>
            <input
              type={column.filterType === 'date' ? 'date' : column.filterType === 'number' ? 'number' : 'text'}
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              placeholder={`Filter ${column.label.toLowerCase()}...`}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </>
        )}
        
        <div className="flex space-x-2 mt-3">
          <button
            onClick={handleApply}
            className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
          >
            Apply
          </button>
          <button
            onClick={handleClear}
            className="flex-1 px-3 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={onClose}
            className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-sm rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

const SortableTableHeader: React.FC<{
  column: TableColumn;
  onResize: (id: string, width: number) => void;
  onToggleVisibility: (id: string) => void;
  onSort?: (columnId: string) => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filter?: ColumnFilter;
  onFilterChange?: (columnId: string, value: string, operator?: string) => void;
  data?: any[];
}> = ({ column, onResize, onToggleVisibility, onSort, sortBy, sortOrder, filter, onFilterChange, data = [] }) => {
  const [resizing, setResizing] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!column.resizable) return;
    e.preventDefault();
    setResizing(true);
    setStartX(e.clientX);
    setStartWidth(column.width);
  };

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(50, startWidth + (e.clientX - startX));
      onResize(column.id, newWidth);
    };

    const handleMouseUp = () => {
      setResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing, startX, startWidth, column.id, onResize]);

  if (!column.visible) return null;

  const getSortIcon = () => {
    if (!column.sortable || sortBy !== column.id) {
      return column.sortable ? (
        <svg className="w-4 h-4 text-gray-400 hover:text-gray-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      ) : null;
    }
    
    return sortOrder === 'asc' ? (
      <svg className="w-4 h-4 text-blue-600 hover:text-blue-800 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-blue-600 hover:text-blue-800 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  const getFilterIcon = () => {
    const hasFilter = filter && filter.value;
    return (
      <svg 
        className={`w-4 h-4 ${hasFilter ? 'text-blue-600 hover:text-blue-800' : 'text-gray-500 hover:text-gray-700'} transition-colors`} 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={hasFilter ? 2.5 : 2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" />
      </svg>
    );
  };

  return (
    <th
      ref={setNodeRef}
      style={{
        ...style,
        width: `${column.width}px`,
        minWidth: `${column.width}px`,
        maxWidth: `${column.width}px`,
      }}
      className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-600 relative group"
      {...attributes}
    >
      <div className="flex items-center justify-between min-h-[28px] relative group">
        <div className="flex items-center flex-1 min-w-0 pr-2">
          <span 
            {...listeners} 
            className="cursor-move select-none truncate text-xs font-medium flex-1"
          >
            {column.label}
          </span>
        </div>
        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity absolute right-0 top-0 bottom-0 bg-gray-50 dark:bg-gray-800 pl-1">
          {column.sortable && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSort?.(column.id);
              }}
              className="flex-shrink-0 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title={`Sort by ${column.label}`}
            >
              {getSortIcon()}
            </button>
          )}
          {column.filterable && onFilterChange && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFilterDropdown(!showFilterDropdown);
                }}
                className="flex-shrink-0 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                title={`Filter ${column.label}`}
              >
                {getFilterIcon()}
              </button>
              {showFilterDropdown && (
                <ColumnFilterDropdown
                  column={column}
                  filter={filter}
                  onFilterChange={onFilterChange}
                  onClose={() => setShowFilterDropdown(false)}
                  data={data}
                />
              )}
            </div>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisibility(column.id);
            }}
            className="flex-shrink-0 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title={`Hide ${column.label} column`}
          >
            <svg className="w-4 h-4 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.464 8.464M14.12 14.12l1.415 1.415M14.12 14.12L9.88 9.88m4.24 4.24l1.415 1.415M9.88 9.88l-1.415-1.415" />
            </svg>
          </button>
        </div>
      </div>
      {column.resizable && (
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 transition-colors"
          onMouseDown={handleMouseDown}
        />
      )}
    </th>
  );
};

function ConfigurableTable<T extends { id: string }>({
  data,
  columns: initialColumns,
  loading = false,
  storageKey,
  title,
  searchTerm = '',
  onSearchChange,
  filters = [],
  columnFilters = [],
  onColumnFiltersChange,
  onRowClick,
  onExport,
  exportFilename,
  getRowStyle,
  actions = [],
  bulkActions = [],
  enableSelection = false,
  onSelectionChange,
  emptyState,
  headerActions,
}: ConfigurableTableProps<T>) {
  const sensors = useSensors(useSensor(PointerSensor));
  const [columns, setColumns] = useState<TableColumn<T>[]>(initialColumns);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [showExportSuccess, setShowExportSuccess] = useState(false);
  const [selectedItems, setSelectedItems] = useState<T[]>([]);
  const [sortBy, setSortBy] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Load preferences from localStorage
  const loadPreferences = (): TablePreferences => {
    const defaultPrefs = {
      columnOrder: initialColumns.map(c => c.id),
      columnWidths: {},
      columnVisibility: {},
    };

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure the parsed data has all required properties with correct types
        return {
          columnOrder: Array.isArray(parsed.columnOrder) ? parsed.columnOrder : defaultPrefs.columnOrder,
          columnWidths: (parsed.columnWidths && typeof parsed.columnWidths === 'object') ? parsed.columnWidths : defaultPrefs.columnWidths,
          columnVisibility: (parsed.columnVisibility && typeof parsed.columnVisibility === 'object') ? parsed.columnVisibility : defaultPrefs.columnVisibility,
        };
      }
    } catch (error) {
      console.error('Error loading table preferences:', error);
    }
    return defaultPrefs;
  };

  // Save preferences to localStorage
  const savePreferences = (preferences: TablePreferences) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(preferences));
    } catch (error) {
      console.error('Error saving table preferences:', error);
    }
  };

  const [preferences, setPreferences] = useState<TablePreferences>(loadPreferences);

  // Apply preferences to columns
  const configuredColumns = useMemo(() => {
    const columnMap = new Map(initialColumns.map(col => [col.id, col]));
    
    // Ensure columnOrder is always an array and contains all current column IDs
    const defaultColumnIds = initialColumns.map(c => c.id);
    let columnOrder = Array.isArray(preferences.columnOrder) ? preferences.columnOrder : defaultColumnIds;
    
    // Add any new columns that aren't in the saved order
    const existingIds = new Set(columnOrder);
    const newColumnIds = defaultColumnIds.filter(id => !existingIds.has(id));
    if (newColumnIds.length > 0) {
      columnOrder = [...columnOrder, ...newColumnIds];
    }
    
    // Remove any column IDs that no longer exist
    columnOrder = columnOrder.filter(id => columnMap.has(id));
    
    // Reorder columns based on preferences
    const orderedColumns = columnOrder
      .map(id => columnMap.get(id))
      .filter(Boolean) as TableColumn<T>[];
    
    // Apply width and visibility preferences
    return orderedColumns.map(col => ({
      ...col,
      width: (preferences.columnWidths && preferences.columnWidths[col.id]) || col.width,
      visible: (preferences.columnVisibility && preferences.columnVisibility[col.id] !== undefined) 
        ? preferences.columnVisibility[col.id] 
        : col.visible
    }));
  }, [initialColumns, preferences]);

  const visibleColumns = useMemo(() => 
    configuredColumns.filter(col => col.visible), 
    [configuredColumns]
  );

  // Update preferences when columns change
  useEffect(() => {
    const currentColumnIds = configuredColumns.map(col => col.id);
    const savedColumnIds = preferences.columnOrder;
    
    // Check if column order needs to be updated
    if (JSON.stringify(currentColumnIds) !== JSON.stringify(savedColumnIds)) {
      const newPreferences = { 
        ...preferences, 
        columnOrder: currentColumnIds 
      };
      setPreferences(newPreferences);
      savePreferences(newPreferences);
    }
  }, [configuredColumns, preferences, savePreferences]);

  // Handle drag and drop
  const handleDragStart = (event: DragStartEvent) => {
    setActiveColumnId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveColumnId(null);

    if (active.id !== over?.id && over?.id) {
      // Get the current column order from configured columns
      const currentColumnOrder = configuredColumns.map(col => col.id);
      
      const oldIndex = currentColumnOrder.indexOf(active.id as string);
      const newIndex = currentColumnOrder.indexOf(over.id as string);
      
      // Only proceed if both columns are found
      if (oldIndex !== -1 && newIndex !== -1) {
        const newColumnOrder = arrayMove(currentColumnOrder, oldIndex, newIndex);
        const newPreferences = { ...preferences, columnOrder: newColumnOrder };
        setPreferences(newPreferences);
        savePreferences(newPreferences);
      }
    }
  };

  const handleColumnResize = (columnId: string, width: number) => {
    const newPreferences = {
      ...preferences,
      columnWidths: { ...preferences.columnWidths, [columnId]: width },
    };
    setPreferences(newPreferences);
    savePreferences(newPreferences);
  };

  const handleToggleColumnVisibility = (columnId: string) => {
    const currentColumn = configuredColumns.find(col => col.id === columnId);
    const newPreferences = {
      ...preferences,
      columnVisibility: { 
        ...preferences.columnVisibility, 
        [columnId]: !currentColumn?.visible 
      },
    };
    setPreferences(newPreferences);
    savePreferences(newPreferences);
  };

  const resetToDefault = () => {
    const defaultPreferences = {
      columnOrder: initialColumns.map(c => c.id),
      columnWidths: {},
      columnVisibility: {},
    };
    setPreferences(defaultPreferences);
    savePreferences(defaultPreferences);
  };

  const handleSort = (columnId: string) => {
    if (sortBy === columnId) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(columnId);
      setSortOrder('asc');
    }
  };

  const handleExportToExcel = () => {
    try {
      if (onExport) {
        onExport();
      } else {
        // Default export logic
        const exportData = data.map(item => {
          const exportItem: any = {};
          visibleColumns.forEach(col => {
            exportItem[col.label] = col.render(item);
          });
          return exportItem;
        });
        
        exportToExcel(exportData, exportFilename || 'table-export.xlsx', 'Data');
      }

      setShowExportSuccess(true);
      setTimeout(() => setShowExportSuccess(false), 3000);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export to Excel. Please try again.');
    }
  };

  const handleSelectAll = () => {
    if (selectedItems.length === data.length) {
      setSelectedItems([]);
      onSelectionChange?.([]);
    } else {
      setSelectedItems(data);
      onSelectionChange?.(data);
    }
  };

  const handleSelectItem = (item: T) => {
    const newSelected = selectedItems.filter(i => i.id !== item.id);
    setSelectedItems(newSelected);
    onSelectionChange?.(newSelected);
  };

  const handleColumnFilterChange = (columnId: string, value: string, operator: string = 'contains') => {
    if (!onColumnFiltersChange) return;
    
    const newFilters = columnFilters.filter(f => f.columnId !== columnId);
    if (value) {
      newFilters.push({ columnId, value, operator: operator as any });
    }
    onColumnFiltersChange(newFilters);
  };

  const applyColumnFilters = (items: T[]): T[] => {
    if (!columnFilters.length) return items;
    
    return items.filter(item => {
      return columnFilters.every(filter => {
        const value = getNestedValue(item, filter.columnId);
        const filterValue = filter.value.toLowerCase();
        const itemValue = String(value || '').toLowerCase();
        
        switch (filter.operator) {
          case 'equals':
            return itemValue === filterValue;
          case 'startsWith':
            return itemValue.startsWith(filterValue);
          case 'endsWith':
            return itemValue.endsWith(filterValue);
          case 'greaterThan':
            return Number(value) > Number(filter.value);
          case 'lessThan':
            return Number(value) < Number(filter.value);
          case 'contains':
          default:
            return itemValue.includes(filterValue);
        }
      });
    });
  };

  const getNestedValue = (obj: any, path: string) => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  };

  const sortedAndFilteredData = useMemo(() => {
    let filteredData = applyColumnFilters(data);
    
    if (searchTerm) {
      filteredData = filteredData.filter(item =>
        Object.values(item).some(value =>
          String(value || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    if (sortBy) {
      filteredData.sort((a, b) => {
        const aValue = getNestedValue(a, sortBy);
        const bValue = getNestedValue(b, sortBy);
        
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        
        const comparison = String(aValue).localeCompare(String(bValue), undefined, { numeric: true });
        return sortOrder === 'asc' ? comparison : -comparison;
      });
    }

    return filteredData;
  }, [data, columnFilters, searchTerm, sortBy, sortOrder]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header section */}
      {(title || onSearchChange || headerActions) && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-4">
            {title && (
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {title}
              </h2>
            )}
            {columnFilters.length > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {columnFilters.length} filter{columnFilters.length > 1 ? 's' : ''} active
                </span>
                <button
                  onClick={() => onColumnFiltersChange?.([])}
                  className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-3">
            {onSearchChange && (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <svg className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            )}
            {headerActions}
          </div>
        </div>
      )}

      {/* Export Success Notification */}
      {showExportSuccess && (
        <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-400 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-700 dark:text-green-200">
                Excel export completed successfully! Check your downloads folder.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Column controls */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex justify-between items-center">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {visibleColumns.length} of {configuredColumns.length} columns visible
        </span>
        <div className="flex space-x-2">
          <button
            onClick={handleExportToExcel}
            className="text-xs px-2 py-1 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 border border-green-300 dark:border-green-600 rounded flex items-center space-x-1"
            title="Export to Excel"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Export Excel</span>
          </button>
          <button
            onClick={resetToDefault}
            className="text-xs px-2 py-1 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded"
          >
            Reset
          </button>
          <button
            onClick={() => setShowColumnSettings(!showColumnSettings)}
            className="text-xs px-2 py-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 border border-blue-300 dark:border-blue-600 rounded"
          >
            {showColumnSettings ? 'Hide' : 'Show'} Column Settings
          </button>
        </div>
      </div>

      {/* Column Settings Panel */}
      {showColumnSettings && (
        <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3 bg-gray-50 dark:bg-gray-900">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Column Visibility</h4>
          <div className="grid grid-cols-3 gap-2">
            {configuredColumns.map(column => (
              <label key={column.id} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={column.visible}
                  onChange={() => handleToggleColumnVisibility(column.id)}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{column.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden bg-white dark:bg-gray-800 shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
        <div className="overflow-x-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <SortableContext
                    items={visibleColumns.map(col => col.id)}
                    strategy={horizontalListSortingStrategy}
                  >
                    {enableSelection && (
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedItems.length === sortedAndFilteredData.length && sortedAndFilteredData.length > 0}
                          onChange={handleSelectAll}
                          className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                      </th>
                    )}
                    {visibleColumns.map(column => (
                      <SortableTableHeader
                        key={column.id}
                        column={column}
                        onResize={handleColumnResize}
                        onToggleVisibility={handleToggleColumnVisibility}
                        onSort={handleSort}
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        filter={columnFilters.find(f => f.columnId === column.id)}
                        onFilterChange={handleColumnFilterChange}
                        data={data}
                      />
                    ))}
                    {actions.length > 0 && (
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </SortableContext>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={visibleColumns.filter(col => col.visible).length + (enableSelection ? 1 : 0) + (actions.length > 0 ? 1 : 0)} className="px-4 py-8 text-center">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span className="ml-2 text-gray-500 dark:text-gray-400">Loading...</span>
                      </div>
                    </td>
                  </tr>
                ) : sortedAndFilteredData.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.filter(col => col.visible).length + (enableSelection ? 1 : 0) + (actions.length > 0 ? 1 : 0)} className="px-4 py-8 text-center">
                      {emptyState || (
                        <div className="text-gray-500 dark:text-gray-400">
                          No data available
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  sortedAndFilteredData.map((item, index) => (
                    <tr
                      key={item.id}
                      className={`${
                        onRowClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700' : ''
                      } ${index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'}`}
                      onClick={() => onRowClick?.(item)}
                      style={getRowStyle?.(item)}
                    >
                      {enableSelection && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedItems.some(selected => selected.id === item.id)}
                            onChange={() => handleSelectItem(item)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          />
                        </td>
                      )}
                      {visibleColumns.map(column => (
                        column.visible && (
                          <td
                            key={column.id}
                            className="px-2 py-3 whitespace-nowrap border-r border-gray-200 dark:border-gray-600"
                            style={{
                              width: `${column.width}px`,
                              minWidth: `${column.width}px`,
                              maxWidth: `${column.width}px`,
                            }}
                          >
                            {column.render(item)}
                          </td>
                        )
                      ))}
                      {actions.length > 0 && (
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center space-x-2">
                            {actions.map((action, actionIndex) => (
                              (!action.show || action.show(item)) && (
                                <button
                                  key={actionIndex}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    action.onClick(item);
                                  }}
                                  className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${action.className || 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                                  title={action.label}
                                >
                                  {action.icon}
                                </button>
                              )
                            ))}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </DndContext>
        </div>
      </div>
    </div>
  );
}

export default ConfigurableTable;