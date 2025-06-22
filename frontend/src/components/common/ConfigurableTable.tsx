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

export interface ConfigurableTableProps<T = any> {
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  storageKey: string;
  title?: string;
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
  filters?: FilterConfig[];
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

const SortableTableHeader: React.FC<{
  column: TableColumn;
  onResize: (id: string, width: number) => void;
  onToggleVisibility: (id: string) => void;
  onSort?: (columnId: string) => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}> = ({ column, onResize, onToggleVisibility, onSort, sortBy, sortOrder }) => {
  const [resizing, setResizing] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

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
        <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      ) : null;
    }
    
    return sortOrder === 'asc' ? (
      <svg className="w-3 h-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-3 h-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
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
      <div className="flex items-center justify-between">
        <div 
          {...listeners} 
          className="cursor-move flex-1 select-none flex items-center space-x-1"
          onClick={() => column.sortable && onSort?.(column.id)}
        >
          <span className={column.sortable ? 'cursor-pointer' : ''}>{column.label}</span>
          {getSortIcon()}
        </div>
        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onToggleVisibility(column.id)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Hide column"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
  columns: defaultColumns,
  loading = false,
  storageKey,
  title,
  searchTerm = '',
  onSearchChange,
  filters = [],
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
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [showExportSuccess, setShowExportSuccess] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Load preferences from localStorage
  const loadPreferences = (): TablePreferences => {
    const defaultPrefs = {
      columnOrder: defaultColumns.map(c => c.id),
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
    const columnMap = new Map(defaultColumns.map(col => [col.id, col]));
    
    // Ensure columnOrder is always an array
    const columnOrder = Array.isArray(preferences.columnOrder) ? preferences.columnOrder : defaultColumns.map(c => c.id);
    
    // Reorder columns based on preferences
    const orderedColumns = columnOrder
      .map(id => columnMap.get(id))
      .filter(Boolean) as TableColumn<T>[];
    
    // Add any new columns that aren't in the saved order
    const existingIds = new Set(columnOrder);
    const newColumns = defaultColumns.filter(col => !existingIds.has(col.id));
    orderedColumns.push(...newColumns);
    
    // Apply width and visibility preferences
    return orderedColumns.map(col => ({
      ...col,
      width: (preferences.columnWidths && preferences.columnWidths[col.id]) || col.width,
      visible: (preferences.columnVisibility && preferences.columnVisibility[col.id] !== undefined) 
        ? preferences.columnVisibility[col.id] 
        : col.visible
    }));
  }, [defaultColumns, preferences]);

  const visibleColumns = useMemo(() => 
    configuredColumns.filter(col => col.visible), 
    [configuredColumns]
  );

  // Handle drag and drop
  const handleDragStart = (event: DragStartEvent) => {
    setActiveColumnId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveColumnId(null);

    if (active.id !== over?.id) {
      const oldIndex = preferences.columnOrder.indexOf(active.id as string);
      const newIndex = preferences.columnOrder.indexOf(over?.id as string);
      
      const newColumnOrder = arrayMove(preferences.columnOrder, oldIndex, newIndex);
      const newPreferences = { ...preferences, columnOrder: newColumnOrder };
      setPreferences(newPreferences);
      savePreferences(newPreferences);
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
      columnOrder: defaultColumns.map(c => c.id),
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
    if (selectedItems.size === data.length) {
      setSelectedItems(new Set());
      onSelectionChange?.([]);
    } else {
      const allIds = new Set(data.map(item => item.id));
      setSelectedItems(allIds);
      onSelectionChange?.(data);
    }
  };

  const handleSelectItem = (item: T) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(item.id)) {
      newSelected.delete(item.id);
    } else {
      newSelected.add(item.id);
    }
    setSelectedItems(newSelected);
    onSelectionChange?.(data.filter(d => newSelected.has(d.id)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
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

      {/* Header with search, filters, and actions */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col space-y-4">
          {/* Title and header actions */}
          {(title || headerActions) && (
            <div className="flex justify-between items-center">
              {title && (
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {title}
                </h2>
              )}
              {headerActions}
            </div>
          )}

          {/* Search and filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            {onSearchChange && (
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full px-3 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                  <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            )}

            {/* Filters */}
            {filters.map((filter) => (
              <div key={filter.key} className="min-w-0 flex-shrink-0">
                {filter.type === 'select' ? (
                  <select
                    value={filter.value}
                    onChange={(e) => filter.onChange(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">{filter.label}</option>
                    {filter.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={filter.type}
                    placeholder={filter.label}
                    value={filter.value}
                    onChange={(e) => filter.onChange(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                )}
              </div>
            ))}
          </div>

          {/* Bulk actions */}
          {enableSelection && selectedItems.size > 0 && bulkActions.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {selectedItems.size} selected
              </span>
              {bulkActions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => action.onClick(data.filter(d => selectedItems.has(d.id)))}
                  className={`flex items-center space-x-1 px-2 py-1 rounded text-sm ${action.className || 'text-blue-600 hover:text-blue-800'}`}
                >
                  {action.icon}
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

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
      <div className="overflow-x-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <table className="w-full table-auto divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                {enableSelection && (
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-600">
                    <input
                      type="checkbox"
                      checked={selectedItems.size === data.length && data.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                )}
                <SortableContext items={visibleColumns.map(col => col.id)} strategy={horizontalListSortingStrategy}>
                  {visibleColumns.map(column => (
                    <SortableTableHeader
                      key={column.id}
                      column={column}
                      onResize={handleColumnResize}
                      onToggleVisibility={handleToggleColumnVisibility}
                      onSort={handleSort}
                      sortBy={sortBy}
                      sortOrder={sortOrder}
                    />
                  ))}
                </SortableContext>
                {actions.length > 0 && (
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {data.length === 0 ? (
                <tr>
                  <td 
                    colSpan={visibleColumns.length + (enableSelection ? 1 : 0) + (actions.length > 0 ? 1 : 0)} 
                    className="px-6 py-12 text-center"
                  >
                    {emptyState || (
                      <div className="text-gray-500 dark:text-gray-400">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No data</h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">No items to display.</p>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr 
                    key={item.id} 
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                    style={getRowStyle?.(item)}
                    onClick={() => onRowClick?.(item)}
                  >
                    {enableSelection && (
                      <td className="px-2 py-2 border-r border-gray-200 dark:border-gray-600">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(item.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleSelectItem(item);
                          }}
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                    )}
                    {visibleColumns.map(column => (
                      <td
                        key={column.id}
                        className="px-2 py-2 border-r border-gray-200 dark:border-gray-600 overflow-hidden"
                        style={{
                          width: `${column.width}px`,
                          minWidth: `${column.width}px`,
                          maxWidth: `${column.width}px`,
                        }}
                      >
                        {column.render(item)}
                      </td>
                    ))}
                    {actions.length > 0 && (
                      <td className="px-2 py-2 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          {actions.map((action, index) => {
                            if (action.show && !action.show(item)) return null;
                            return (
                              <button
                                key={index}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  action.onClick(item);
                                }}
                                className={`${action.className || 'text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300'}`}
                                title={action.label}
                              >
                                {action.icon}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <DragOverlay>
            {activeColumnId ? (
              <div className="bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700 rounded px-3 py-2 text-sm font-medium">
                {configuredColumns.find(col => col.id === activeColumnId)?.label}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

export default ConfigurableTable;