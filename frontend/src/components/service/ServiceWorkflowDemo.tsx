import React, { useState } from 'react';
import ServiceWorkflow from './ServiceWorkflow';

const ServiceWorkflowDemo: React.FC = () => {
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string>('');

  // Mock ticket data for demo
  const mockTickets = [
    {
      ticket_id: 'ticket-001',
      ticket_number: 'TKT-2024-001',
      title: 'BW3 Device Power Issue',
      description: 'Customer reports device won\'t power on',
      status: 'open',
      urgency: 'high'
    },
    {
      ticket_id: 'ticket-002', 
      ticket_number: 'TKT-2024-002',
      title: 'Display Flickering Problem',
      description: 'Intermittent display issues during operation',
      status: 'open',
      urgency: 'medium'
    },
    {
      ticket_id: 'ticket-003',
      ticket_number: 'TKT-2024-003', 
      title: 'Calibration Required',
      description: 'Annual calibration and maintenance check',
      status: 'open',
      urgency: 'low'
    }
  ];

  const openWorkflow = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setShowWorkflow(true);
  };

  const closeWorkflow = () => {
    setShowWorkflow(false);
    setSelectedTicketId('');
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Service Workflow Management Demo
        </h1>
        <p className="text-gray-600 mb-6">
          This demo showcases the comprehensive 10-step device service workflow with all detailed fields, 
          conditional validation, and progress tracking capabilities.
        </p>
        
        {/* Feature Highlights */}
        <div className="bg-blue-50 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-blue-900 mb-4">Key Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-2">📋 Comprehensive Fields</h3>
              <p className="text-sm text-gray-600">
                All 10 steps with detailed field definitions including parts tables, 
                checklists, and conditional requirements.
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-2">✅ Smart Validation</h3>
              <p className="text-sm text-gray-600">
                Conditional field validation, required field checking, 
                and business rule enforcement (e.g., different agents for approval).
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-2">🔄 Progress Tracking</h3>
              <p className="text-sm text-gray-600">
                Visual step progression, status indicators, 
                and automatic workflow advancement.
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-2">🏷️ Optional Steps</h3>
              <p className="text-sm text-gray-600">
                Smart handling of optional steps like loaner shipment 
                and return based on user selections.
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-2">📊 Rich Data Types</h3>
              <p className="text-sm text-gray-600">
                Support for complex data including parts tables, 
                test checklists, and file attachments.
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="font-semibent text-gray-900 mb-2">🔍 Audit Trail</h3>
              <p className="text-sm text-gray-600">
                Complete audit logging of all workflow actions, 
                step updates, and user interactions.
              </p>
            </div>
          </div>
        </div>

        {/* Workflow Steps Overview */}
        <div className="bg-gray-50 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">10-Step Workflow Process</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center text-sm">
                <span className="px-3 py-1 bg-blue-500 text-white rounded-lg text-xs font-semibold mr-3">Step 1</span>
                <span className="font-medium">Request Device for Repair</span>
              </div>
              <div className="flex items-center text-sm">
                <span className="px-3 py-1 bg-yellow-500 text-white rounded-lg text-xs font-semibold mr-3">Step 2</span>
                <span className="font-medium">Ship Loaner to Customer</span>
                <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Optional</span>
              </div>
              <div className="flex items-center text-sm">
                <span className="px-3 py-1 bg-blue-500 text-white rounded-lg text-xs font-semibold mr-3">Step 3</span>
                <span className="font-medium">Receiving, Inspection & Cleaning</span>
              </div>
              <div className="flex items-center text-sm">
                <span className="px-3 py-1 bg-blue-500 text-white rounded-lg text-xs font-semibold mr-3">Step 4</span>
                <span className="font-medium">Defect Analysis</span>
              </div>
              <div className="flex items-center text-sm">
                <span className="px-3 py-1 bg-blue-500 text-white rounded-lg text-xs font-semibold mr-3">Step 5</span>
                <span className="font-medium">Quote & Approval</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center text-sm">
                <span className="px-3 py-1 bg-blue-500 text-white rounded-lg text-xs font-semibold mr-3">Step 6</span>
                <span className="font-medium">Correction and Technical Report</span>
              </div>
              <div className="flex items-center text-sm">
                <span className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs font-semibold mr-3">Step 7</span>
                <span className="font-medium">Final Service Approval</span>
                <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded">Different Agent</span>
              </div>
              <div className="flex items-center text-sm">
                <span className="px-3 py-1 bg-blue-500 text-white rounded-lg text-xs font-semibold mr-3">Step 8</span>
                <span className="font-medium">Device Return to Customer</span>
              </div>
              <div className="flex items-center text-sm">
                <span className="px-3 py-1 bg-blue-500 text-white rounded-lg text-xs font-semibold mr-3">Step 9</span>
                <span className="font-medium">Post-Service Confirmation</span>
              </div>
              <div className="flex items-center text-sm">
                <span className="px-3 py-1 bg-yellow-500 text-white rounded-lg text-xs font-semibold mr-3">Step 10</span>
                <span className="font-medium">Loaner Return to Company</span>
                <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Conditional</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mock Tickets Table */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Available Tickets</h2>
          <p className="text-sm text-gray-600">Select a ticket to open its service workflow</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ticket Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Urgency
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {mockTickets.map((ticket) => (
                <tr key={ticket.ticket_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                    {ticket.ticket_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {ticket.title}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                    {ticket.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      ticket.urgency === 'high' ? 'bg-red-100 text-red-800' :
                      ticket.urgency === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {ticket.urgency.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => openWorkflow(ticket.ticket_id)}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      Open Service Workflow
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Service Workflow Modal */}
      {showWorkflow && selectedTicketId && (
        <ServiceWorkflow
          ticketId={selectedTicketId}
          onClose={closeWorkflow}
        />
      )}
    </div>
  );
};

export default ServiceWorkflowDemo; 