import React, { useState } from 'react';
import DeviceList from './DeviceList';
import DeviceDetail from './DeviceDetail';

interface Device {
  id: string;
  customerId: string;
  model: string;
  serialNumber: string;
  warrantyExpires: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  comments: string | null;
  customerName: string;
  customerEmail: string;
  customerCountry: string | null;
  companyName?: string;
  ticketCount: number;
  serviceCount: number;
  linkedTickets: Array<{
    id: string;
    ticketNumber: string;
    title: string;
    status: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface DeviceManagementProps {
  onTicketSelect?: (ticketId: string) => void;
}

const DeviceManagement: React.FC<DeviceManagementProps> = ({ onTicketSelect }) => {
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  const handleDeviceSelect = (device: Device) => {
    setSelectedDevice(device);
  };

  const handleBackToList = () => {
    setSelectedDevice(null);
  };

  const handleTicketSelect = (ticketId: string) => {
    if (onTicketSelect) {
      onTicketSelect(ticketId);
    }
  };

  if (selectedDevice) {
    return (
      <DeviceDetail
        device={selectedDevice}
        onBack={handleBackToList}
        onTicketSelect={handleTicketSelect}
      />
    );
  }

  return (
    <DeviceList onDeviceSelect={handleDeviceSelect} />
  );
};

export default DeviceManagement; 