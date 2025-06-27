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
import { Ticket } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { exportTicketsToExcel, generateExportFilename } from '../../utils/excelExport';

interface Column {
  id: string;
  label: string;
  width: number;
  visible: boolean;
  resizable: boolean;
  sortable?: boolean;
  filterable?: boolean;
  filterType?: 'text' | 'select' | 'date' | 'number';
  filterOptions?: Array<{ value: string; label: string }>;
  render: (ticket: Ticket) => React.ReactNode;
}

interface ColumnFilter {
  columnId: string;
  value: string;
  operator?: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan';
}

interface TablePreferences {
  columnOrder: string[];
  columnWidths: Record<string, number>;
  columnVisibility: Record<string, boolean>;
}

interface ConfigurableTicketTableProps {
  tickets: Ticket[];
  onTicketSelect: (ticket: Ticket) => void;
  onDeleteTicket?: (ticketId: string) => void;
  onReassignTicket?: (ticketId: string, newAgentId: string) => void;
  urgencyIndicator: React.ComponentType<{ ticket: Ticket; onUrgencyChange?: (ticketId: string, urgency: string, message: string) => void }>;
  getWarningInfo: (ticket: Ticket) => { message: string; color: string };
  getStatusColor: (status: string) => string;
  getPriorityColor: (priority: string) => string;
  formatDate: (dateString: string) => string;
  formatRelativeTime: (dateString: string) => string;
  getLastCustomerMessage: (ticket: Ticket) => any;
  getLastAgentMessage: (ticket: Ticket) => any;
  formatStatus: (status: string) => string;
  getRowStyle: (ticketId: string) => React.CSSProperties;
  handleUrgencyChange: (ticketId: string, urgency: string, message: string) => void;
  agents: any[];
  reassignTicketId: string | null;
  setReassignTicketId: (id: string | null) => void;
  reassigning: boolean;
  deletingTicketId: string | null;
  // Export functionality props
  exportFilters?: {
    searchTerm?: string;
    statusFilter?: string;
    priorityFilter?: string;
    currentView?: string;
  };
}

const STORAGE_KEY = 'agent-ticket-table-preferences';

const ColumnFilterDropdown: React.FC<{
  column: Column;
  filter: ColumnFilter | undefined;
  onFilterChange: (columnId: string, value: string, operator?: string) => void;
  onClose: () => void;
  data: Ticket[];
}> = ({ column, filter, onFilterChange, onClose, data }) => {
  const [tempValue, setTempValue] = useState<string>(filter?.value || '');
  const [tempOperator, setTempOperator] = useState<string>(filter?.operator || 'contains');

  const getUniqueValues = () => {
    if (column.filterOptions) return column.filterOptions;
    
    const values = new Set<string>();
    data.forEach(item => {
      let value;
      
      // Special handling for columns with different data paths
      if (column.id === 'company') {
        value = item.customerCompany;
      } else if (column.id === 'agent') {
        value = item.agent ? item.agent.name : 'NA';
      } else if (column.id === 'customer') {
        value = item.customerName || item.customer?.name || 'Not provided';
      } else if (column.id === 'created') {
        value = item.createdAt;
      } else if (column.id === 'lastCustomerMsg') {
        // For message columns, we'll just indicate if there are messages or not
        value = 'Message data'; // Will be handled by text filter
      } else if (column.id === 'lastAgentMsg') {
        // For message columns, we'll just indicate if there are messages or not
        value = 'Message data'; // Will be handled by text filter
      } else if (column.id === 'service') {
        value = item.hasServiceWorkflow ? 'YES' : 'NO';
      } else {
        value = getNestedValue(item, column.id);
      }
      
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
  column: Column;
  onResize: (id: string, width: number) => void;
  onToggleVisibility: (id: string) => void;
  onSort?: (columnId: string) => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filter?: ColumnFilter;
  onFilterChange?: (columnId: string, value: string, operator?: string) => void;
  data?: Ticket[];
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

const ConfigurableTicketTable: React.FC<ConfigurableTicketTableProps> = (props) => {
  const { user } = useAuth();
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [showExportSuccess, setShowExportSuccess] = useState(false);
  const [columnFilters, setColumnFilters] = useState<ColumnFilter[]>([]);
  const [sortBy, setSortBy] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Initialize columns with default configuration
  const createDefaultColumns = (): Column[] => [
    {
      id: 'urgency',
      label: 'Ticket time duration',
      width: 80,
      visible: true,
      resizable: true,
      sortable: false, // Special component, not sortable
      filterable: false, // Special component, not filterable
      render: (ticket) => <props.urgencyIndicator ticket={ticket} onUrgencyChange={props.handleUrgencyChange} />,
    },
    {
      id: 'warning',
      label: 'Warning',
      width: 120,
      visible: true,
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'text',
      render: (ticket) => {
        const warning = props.getWarningInfo(ticket);
        return (
          <div className={`inline-flex items-start px-2 py-1 rounded text-xs font-medium border ${warning.color}`}>
            <span className="break-words leading-tight" style={{lineHeight: '1.2'}}>
              {warning.message}
            </span>
          </div>
        );
      },
    },
    {
      id: 'ticket',
      label: 'Ticket',
      width: 200,
      visible: true,
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'text',
      render: (ticket) => (
        <div className="w-full">
          <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {ticket.title}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            #{ticket.ticketNumber || ticket.id}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-300 mt-1 truncate">
            {ticket.description}
          </div>
        </div>
      ),
    },
    {
      id: 'customer',
      label: 'Customer Name',
      width: 120,
      visible: true,
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'text',
      render: (ticket) => (
        <div className="text-sm text-gray-900 dark:text-white truncate">
          {ticket.customerName || ticket.customer?.name || 'Not provided'}
        </div>
      ),
    },
    {
      id: 'company',
      label: 'Company',
      width: 120,
      visible: true,
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'text',
      render: (ticket) => (
        <div className="text-sm text-gray-900 dark:text-white truncate">
          {ticket.customerCompany || 'Not provided'}
        </div>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      width: 100,
      visible: true,
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'select',
      filterOptions: [
        { value: 'open', label: 'Open' },
        { value: 'in-progress', label: 'In Progress' },
        { value: 'resolved', label: 'Resolved' },
        { value: 'closed', label: 'Closed' }
      ],
      render: (ticket) => {
        const statusElement = (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${props.getStatusColor(ticket.status)}`}>
            {props.formatStatus(ticket.status)}
            {ticket.status === 'resolved' && ticket.resolutionSummary && (
              <svg className="ml-1 w-3 h-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
          </span>
        );

        // Add tooltip for resolved tickets with summaries
        if (ticket.status === 'resolved' && ticket.resolutionSummary) {
          return (
            <div className="relative group">
              {statusElement}
              <div className="absolute z-50 invisible group-hover:visible bg-gray-900 text-white text-xs rounded-lg py-2 px-3 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-80 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="font-semibold mb-1">AI Summary:</div>
                <div className="text-left leading-relaxed">{ticket.resolutionSummary}</div>
                {ticket.resolutionSummaryGeneratedAt && (
                  <div className="text-xs text-gray-300 mt-1 text-right">
                    Generated {new Date(ticket.resolutionSummaryGeneratedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                )}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
              </div>
            </div>
          );
        }

        return statusElement;
      },
    },
    {
      id: 'priority',
      label: 'Priority',
      width: 80,
      visible: true,
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'select',
      filterOptions: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
        { value: 'critical', label: 'Critical' }
      ],
      render: (ticket) => (
        <span className={`text-sm font-medium capitalize ${props.getPriorityColor(ticket.priority)}`}>
          {ticket.priority}
        </span>
      ),
    },
    {
      id: 'agent',
      label: 'Agent',
      width: 100,
      visible: true,
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'text',
      render: (ticket) => (
        <div className="text-sm text-gray-900 dark:text-white truncate">
          {ticket.agent ? ticket.agent.name : 'NA'}
        </div>
      ),
    },
    {
      id: 'lastCustomerMsg',
      label: 'Last Customer Msg',
      width: 120,
      visible: true,
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'text',
      render: (ticket) => {
        const lastCustomerMsg = props.getLastCustomerMessage(ticket);
        return (
          <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {lastCustomerMsg ? props.formatRelativeTime(lastCustomerMsg.createdAt) : 'No messages'}
          </div>
        );
      },
    },
    {
      id: 'lastAgentMsg',
      label: 'Last Agent Msg',
      width: 120,
      visible: true,
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'text',
      render: (ticket) => {
        const lastAgentMsg = props.getLastAgentMessage(ticket);
        return (
          <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {lastAgentMsg ? props.formatRelativeTime(lastAgentMsg.createdAt) : 'No messages'}
          </div>
        );
      },
    },
    {
      id: 'created',
      label: 'Created',
      width: 100,
      visible: true,
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'date',
      render: (ticket) => (
        <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
          {props.formatDate(ticket.createdAt)}
        </div>
      ),
    },
    // New hidden columns as requested
    {
      id: 'customerCountry',
      label: 'Country',
      width: 100,
      visible: false, // Hidden by default
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'select',
      render: (ticket) => (
        <div className="text-sm text-gray-900 dark:text-white truncate">
          {ticket.customerCountry || 'Not provided'}
        </div>
      ),
    },
    {
      id: 'customerStreetAddress',
      label: 'Address',
      width: 150,
      visible: false, // Hidden by default
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'text',
      render: (ticket) => (
        <div className="text-sm text-gray-900 dark:text-white truncate">
          {ticket.customerStreetAddress || ticket.customerAddress || 'Not provided'}
        </div>
      ),
    },
    {
      id: 'customerCity',
      label: 'City',
      width: 100,
      visible: false, // Hidden by default
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'select',
      render: (ticket) => (
        <div className="text-sm text-gray-900 dark:text-white truncate">
          {ticket.customerCity || 'Not provided'}
        </div>
      ),
    },
    {
      id: 'customerState',
      label: 'State',
      width: 100,
      visible: false, // Hidden by default
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'select',
      render: (ticket) => (
        <div className="text-sm text-gray-900 dark:text-white truncate">
          {ticket.customerState || 'Not provided'}
        </div>
      ),
    },
    {
      id: 'customerEmail',
      label: 'Email',
      width: 150,
      visible: false, // Hidden by default
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'text',
      render: (ticket) => (
        <div className="text-sm text-gray-900 dark:text-white truncate">
          {ticket.customerEmail || 'Not provided'}
        </div>
      ),
    },
    {
      id: 'customerPhone',
      label: 'Telephone',
      width: 120,
      visible: false, // Hidden by default
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'text',
      render: (ticket) => (
        <div className="text-sm text-gray-900 dark:text-white truncate">
          {ticket.customerPhone || 'Not provided'}
        </div>
      ),
    },
    {
      id: 'customerType',
      label: 'Customer Type',
      width: 120,
      visible: false, // Hidden by default
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'select',
      filterOptions: [
        { value: 'VIP', label: 'VIP' },
        { value: 'Distributor', label: 'Distributor' },
        { value: 'Standard', label: 'Standard' }
      ],
      render: (ticket) => (
        <div className="text-sm text-gray-900 dark:text-white truncate">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            ticket.customerType === 'VIP' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
            ticket.customerType === 'Distributor' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
          }`}>
            {ticket.customerType || 'Standard'}
          </span>
        </div>
      ),
    },
    {
      id: 'deviceModel',
      label: 'Device Model',
      width: 100,
      visible: true,
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'select',
      render: (ticket) => (
        <div className="text-sm text-gray-900 dark:text-white truncate">
          {ticket.deviceModel || 'Not specified'}
        </div>
      ),
    },
    {
      id: 'deviceSerialNumber',
      label: 'Device Serial #',
      width: 120,
      visible: true,
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'text',
      render: (ticket) => (
        <div className="text-sm text-gray-900 dark:text-white truncate">
          {ticket.deviceSerialNumber || 'Not provided'}
        </div>
      ),
    },
    {
      id: 'service',
      label: 'Service',
      width: 80,
      visible: true,
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'select',
      filterOptions: [
        { value: 'yes', label: 'YES' },
        { value: 'no', label: 'NO' }
      ],
      render: (ticket) => (
        <div className="text-sm font-medium text-center">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            ticket.hasServiceWorkflow ? 
              'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
              'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
          }`}>
            {ticket.hasServiceWorkflow ? 'YES' : 'NO'}
          </span>
        </div>
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      width: 120,
      visible: true,
      resizable: false,
      sortable: false, // Actions column should not be sortable
      render: (ticket) => (
        <div className="flex items-center justify-end space-x-2">
          <button
            onClick={() => props.onTicketSelect(ticket)}
            className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
            title="View ticket"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          {user?.permissions?.includes('tickets.edit') && (
            <button
              onClick={() => props.onTicketSelect(ticket)}
              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
              title="Edit ticket"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          {user?.permissions?.includes('tickets.edit') && ticket.status !== 'resolved' && props.onReassignTicket && (
            <div className="relative">
              {props.reassignTicketId === ticket.id ? (
                <select
                  onChange={(e) => {
                    if (e.target.value !== ticket.agentId) {
                      if (e.target.value === 'unassign') {
                        props.onReassignTicket!(ticket.id, '');
                      } else if (e.target.value) {
                        props.onReassignTicket!(ticket.id, e.target.value);
                      } else {
                        props.setReassignTicketId(null);
                      }
                    } else {
                      props.setReassignTicketId(null);
                    }
                  }}
                  onBlur={() => props.setReassignTicketId(null)}
                  className="text-xs border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  disabled={props.reassigning}
                  defaultValue=""
                  autoFocus
                >
                  <option value="">Cancel</option>
                  {ticket.agentId && (
                    <option value="unassign">⊘ Unassign</option>
                  )}
                  {props.agents.map(agent => {
                    const isOnline = agent.isOnline || false;
                    const statusIndicator = isOnline ? '🟢' : '🔴';
                    return (
                      <option key={agent.id} value={agent.id}>
                        {statusIndicator} {agent.roleName} - {agent.name}
                        {agent.id === ticket.agentId ? ' (Current)' : ''}
                        {agent.id === user?.id ? ' (You)' : ''}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    props.setReassignTicketId(ticket.id);
                  }}
                  className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300 font-medium"
                  title={ticket.agentId ? "Reassign ticket" : "Assign ticket"}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </button>
              )}
            </div>
          )}
          {user?.permissions?.includes('tickets.delete') && props.onDeleteTicket && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                props.onDeleteTicket!(ticket.id);
              }}
              disabled={props.deletingTicketId === ticket.id}
              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              title="Delete ticket"
            >
              {props.deletingTicketId === ticket.id ? (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
            </button>
          )}
        </div>
      ),
    },
  ];

  // Load preferences from localStorage
  const loadPreferences = (): TablePreferences => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const defaultColumns = createDefaultColumns();
        
        // Use saved column visibility preferences
        const updatedVisibility = {
          ...parsed.columnVisibility,
        };
        
        // Ensure device columns are in the column order
        let updatedColumnOrder = parsed.columnOrder || defaultColumns.map(c => c.id);
        if (!updatedColumnOrder.includes('deviceModel')) {
          updatedColumnOrder.push('deviceModel');
        }
        if (!updatedColumnOrder.includes('deviceSerialNumber')) {
          updatedColumnOrder.push('deviceSerialNumber');
        }
        
        return {
          columnOrder: updatedColumnOrder,
          columnWidths: parsed.columnWidths || {},
          columnVisibility: updatedVisibility,
        };
      }
    } catch (error) {
      console.error('Error loading table preferences:', error);
    }
    const defaultColumns = createDefaultColumns();
    return {
      columnOrder: defaultColumns.map(c => c.id),
      columnWidths: {},
      columnVisibility: {},
    };
  };

  // Save preferences to localStorage
  const savePreferences = (preferences: TablePreferences) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error('Error saving table preferences:', error);
    }
  };

  const [preferences, setPreferences] = useState<TablePreferences>(loadPreferences);
  const defaultColumns = createDefaultColumns();

  // Apply preferences to columns
  const configuredColumns = useMemo(() => {
    const columnsMap = new Map(defaultColumns.map(col => [col.id, col]));
    
    return preferences.columnOrder.map(columnId => {
      const column = columnsMap.get(columnId);
      if (!column) return null;
      
      return {
        ...column,
        width: preferences.columnWidths[columnId] || column.width,
        visible: preferences.columnVisibility[columnId] !== false,
      };
    }).filter(Boolean) as Column[];
  }, [preferences, defaultColumns]);

  const visibleColumns = configuredColumns.filter(col => col.visible);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

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
    const newPreferences = {
      ...preferences,
      columnVisibility: { 
        ...preferences.columnVisibility, 
        [columnId]: !configuredColumns.find(col => col.id === columnId)?.visible 
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

  const handleColumnFilterChange = (columnId: string, value: string, operator: string = 'contains') => {
    const newFilters = columnFilters.filter(f => f.columnId !== columnId);
    if (value) {
      newFilters.push({ columnId, value, operator: operator as any });
    }
    setColumnFilters(newFilters);
  };

  const applyColumnFilters = (tickets: Ticket[]): Ticket[] => {
    if (!columnFilters.length) return tickets;
    
    return tickets.filter(ticket => {
      return columnFilters.every(filter => {
        // Special handling for columns with different data paths
        let value;
        
        if (filter.columnId === 'service') {
          if (filter.value === 'yes') {
            return ticket.hasServiceWorkflow === true;
          } else if (filter.value === 'no') {
            return ticket.hasServiceWorkflow === false;
          }
          return true; // Show all if no specific filter
        } else if (filter.columnId === 'company') {
          value = ticket.customerCompany || '';
        } else if (filter.columnId === 'agent') {
          value = ticket.agent ? ticket.agent.name : 'NA';
        } else if (filter.columnId === 'customer') {
          value = ticket.customerName || ticket.customer?.name || 'Not provided';
        } else if (filter.columnId === 'created') {
          value = ticket.createdAt;
        } else if (filter.columnId === 'lastCustomerMsg') {
          const lastMsg = props.getLastCustomerMessage(ticket);
          value = lastMsg ? props.formatRelativeTime(lastMsg.createdAt) : 'No messages';
        } else if (filter.columnId === 'lastAgentMsg') {
          const lastMsg = props.getLastAgentMessage(ticket);
          value = lastMsg ? props.formatRelativeTime(lastMsg.createdAt) : 'No messages';
        } else {
          value = getNestedValue(ticket, filter.columnId);
        }

        if (value === null || value === undefined || value === '') {
          return filter.value === '' || filter.value === 'all';
        }

        const filterValue = filter.value.toLowerCase();
        const itemValue = String(value).toLowerCase();
        
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

  const handleSort = (columnId: string) => {
    if (sortBy === columnId) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(columnId);
      setSortOrder('asc');
    }
  };

  const sortedAndFilteredTickets = useMemo(() => {
    let filteredData = applyColumnFilters(props.tickets);
    
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
  }, [props.tickets, columnFilters, sortBy, sortOrder]);

  const handleExportToExcel = () => {
    try {
      const filename = generateExportFilename(props.exportFilters);
      
      exportTicketsToExcel({
        tickets: props.tickets,
        visibleColumns: visibleColumns.map(col => ({
          id: col.id,
          label: col.label,
          visible: col.visible
        })),
        filename,
        sheetName: 'Tickets',
        filters: props.exportFilters,
        getLastCustomerMessage: props.getLastCustomerMessage,
        getLastAgentMessage: props.getLastAgentMessage,
        formatRelativeTime: props.formatRelativeTime
      });

      // Show success notification
      setShowExportSuccess(true);
      setTimeout(() => setShowExportSuccess(false), 3000);
      console.log('Export completed successfully');
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export tickets to Excel. Please try again.');
    }
  };

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
      
      {/* Column Settings Button */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {visibleColumns.length} of {configuredColumns.length} columns visible
          </span>
          {columnFilters.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {columnFilters.length} filter{columnFilters.length > 1 ? 's' : ''} active
              </span>
              <button
                onClick={() => setColumnFilters([])}
                className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleExportToExcel}
            className="text-xs px-2 py-1 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 border border-green-300 dark:border-green-600 rounded flex items-center space-x-1"
            title="Export visible columns to Excel"
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
                <SortableContext items={visibleColumns.map(col => col.id)} strategy={horizontalListSortingStrategy}>
                  {visibleColumns.map(column => (
                    <SortableTableHeader
                      key={column.id}
                      column={column}
                      onResize={handleColumnResize}
                      onToggleVisibility={handleToggleColumnVisibility}
                      onSort={(columnId) => handleSort(columnId)}
                      sortBy={sortBy}
                      sortOrder={sortOrder}
                      filter={columnFilters.find(f => f.columnId === column.id)}
                      onFilterChange={handleColumnFilterChange}
                      data={props.tickets}
                    />
                  ))}
                </SortableContext>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {sortedAndFilteredTickets.map((ticket) => (
                <tr 
                  key={ticket.id} 
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  style={props.getRowStyle(ticket.id)}
                >
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
                      {column.render(ticket)}
                    </td>
                  ))}
                </tr>
              ))}
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
};

export default ConfigurableTicketTable; 