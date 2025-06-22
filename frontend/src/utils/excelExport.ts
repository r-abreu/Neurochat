import * as XLSX from 'xlsx';
import { Ticket } from '../types';

interface Column {
  id: string;
  label: string;
  visible: boolean;
  render?: (ticket: Ticket) => string | number | boolean;
}

interface ExportOptions {
  tickets: Ticket[];
  visibleColumns: Column[];
  filename?: string;
  sheetName?: string;
  filters?: {
    searchTerm?: string;
    statusFilter?: string;
    priorityFilter?: string;
    currentView?: string;
  };
  // Helper functions to calculate complex values
  getLastCustomerMessage?: (ticket: Ticket) => any;
  getLastAgentMessage?: (ticket: Ticket) => any;
  formatRelativeTime?: (dateString: string) => string;
}

// Helper function to extract plain text from rendered content
const extractTextValue = (
  ticket: Ticket, 
  columnId: string, 
  helpers?: {
    getLastCustomerMessage?: (ticket: Ticket) => any;
    getLastAgentMessage?: (ticket: Ticket) => any;
    formatRelativeTime?: (dateString: string) => string;
  }
): string | number | boolean => {
  switch (columnId) {
    case 'urgency':
      return 'N/A'; // Urgency is a visual indicator, not text
    case 'warning':
      return 'N/A'; // Warning is a visual indicator, not text
    case 'ticket':
      return `${ticket.title}\n#${ticket.ticketNumber || ticket.id}\n${ticket.description}`;
    case 'customer':
      return ticket.customerName || ticket.customer?.name || 'Not provided';
    case 'company':
      return ticket.customerCompany || 'Not provided';
    case 'status':
      return ticket.status;
    case 'priority':
      return ticket.priority;
    case 'agent':
      return ticket.agent ? ticket.agent.name : 'Unassigned';
    case 'lastCustomerMsg':
      if (helpers?.getLastCustomerMessage && helpers?.formatRelativeTime) {
        const lastMsg = helpers.getLastCustomerMessage(ticket);
        return lastMsg ? helpers.formatRelativeTime(lastMsg.createdAt) : 'No messages';
      }
      return 'N/A';
    case 'lastAgentMsg':
      if (helpers?.getLastAgentMessage && helpers?.formatRelativeTime) {
        const lastMsg = helpers.getLastAgentMessage(ticket);
        return lastMsg ? helpers.formatRelativeTime(lastMsg.createdAt) : 'No messages';
      }
      return 'N/A';
    case 'created':
      return new Date(ticket.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    case 'customerCountry':
      return ticket.customerCountry || 'Not provided';
    case 'customerStreetAddress':
      return ticket.customerStreetAddress || ticket.customerAddress || 'Not provided';
    case 'customerCity':
      return ticket.customerCity || 'Not provided';
    case 'customerState':
      return ticket.customerState || 'Not provided';
    case 'customerEmail':
      return ticket.customerEmail || 'Not provided';
    case 'customerPhone':
      return ticket.customerPhone || 'Not provided';
    case 'customerType':
      return ticket.customerType || 'Standard';
    case 'deviceModel':
      return ticket.deviceModel || 'Not specified';
    case 'deviceSerialNumber':
      return ticket.deviceSerialNumber || 'Not provided';
    default:
      return 'N/A';
  }
};

export const exportTicketsToExcel = (options: ExportOptions): void => {
  const {
    tickets,
    visibleColumns,
    filename = 'tickets-export.xlsx',
    sheetName = 'Tickets',
    filters,
    getLastCustomerMessage,
    getLastAgentMessage,
    formatRelativeTime
  } = options;

  try {
    // Filter out the actions column since it's not exportable
    const exportableColumns = visibleColumns.filter(col => col.id !== 'actions');

    // Create headers
    const headers = exportableColumns.map(col => col.label);

    // Create data rows
    const data = tickets.map(ticket => {
      const row: { [key: string]: string | number | boolean } = {};
      const helpers = { getLastCustomerMessage, getLastAgentMessage, formatRelativeTime };
      exportableColumns.forEach(col => {
        row[col.label] = extractTextValue(ticket, col.id, helpers);
      });
      return row;
    });

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Set column widths for better readability
    const columnWidths = exportableColumns.map(col => {
      switch (col.id) {
        case 'ticket':
          return { width: 50 }; // Wider for title + description
        case 'customerStreetAddress':
          return { width: 30 };
        case 'customer':
        case 'company':
          return { width: 20 };
        case 'created':
          return { width: 18 };
        default:
          return { width: 15 };
      }
    });
    ws['!cols'] = columnWidths;

    // Add metadata sheet with filter information
    const metadataSheet = XLSX.utils.aoa_to_sheet([
      ['Export Information'],
      ['Generated at:', new Date().toLocaleString()],
      ['Total records:', tickets.length],
      [''],
      ['Applied Filters:'],
      ['Search term:', filters?.searchTerm || 'None'],
      ['Status filter:', filters?.statusFilter === 'all' ? 'All' : (filters?.statusFilter || 'All')],
      ['Priority filter:', filters?.priorityFilter === 'all' ? 'All' : (filters?.priorityFilter || 'All')],
      ['Current view:', filters?.currentView || 'All tickets'],
      [''],
      ['Exported Columns:'],
      ...exportableColumns.map(col => ['', col.label])
    ]);

    // Set metadata sheet column widths
    metadataSheet['!cols'] = [{ width: 20 }, { width: 30 }];

    // Add sheets to workbook
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.utils.book_append_sheet(wb, metadataSheet, 'Export Info');

    // Generate and download the file
    XLSX.writeFile(wb, filename);

    console.log(`Excel file exported: ${filename}`);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    throw new Error('Failed to export tickets to Excel. Please try again.');
  }
};

// Helper function to generate filename with timestamp and filters
export const generateExportFilename = (filters?: {
  searchTerm?: string;
  statusFilter?: string;
  priorityFilter?: string;
  currentView?: string;
}): string => {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
  let filename = `tickets-export-${timestamp}`;

  if (filters) {
    const parts: string[] = [];
    
    if (filters.currentView && filters.currentView !== 'tickets') {
      parts.push(filters.currentView.replace(/[^a-zA-Z0-9]/g, '-'));
    }
    
    if (filters.statusFilter && filters.statusFilter !== 'all') {
      parts.push(`status-${filters.statusFilter}`);
    }
    
    if (filters.priorityFilter && filters.priorityFilter !== 'all') {
      parts.push(`priority-${filters.priorityFilter}`);
    }
    
    if (filters.searchTerm) {
      const cleanSearch = filters.searchTerm.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 20);
      parts.push(`search-${cleanSearch}`);
    }
    
    if (parts.length > 0) {
      filename += '-' + parts.join('-');
    }
  }

  return filename + '.xlsx';
}; 