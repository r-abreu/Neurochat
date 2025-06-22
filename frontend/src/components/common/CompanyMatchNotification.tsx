import React, { useState } from 'react';

interface CompanyMatchNotificationProps {
  match: {
    id: string;
    ticketId: string;
    ticketNumber?: string;
    customerName: string;
    inputCompanyName: string;
    suggestedCompany: {
      id: string;
      name: string;
      description?: string;
    };
    confidence: number;
    message: string;
  };
  onApprove: (matchId: string) => void;
  onReject: (matchId: string) => void;
  onDismiss: (matchId: string) => void;
}

const CompanyMatchNotification: React.FC<CompanyMatchNotificationProps> = ({
  match,
  onApprove,
  onReject,
  onDismiss
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      await onApprove(match.id);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      await onReject(match.id);
    } finally {
      setIsProcessing(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 95) return 'text-green-600 bg-green-100';
    if (confidence >= 90) return 'text-blue-600 bg-blue-100';
    if (confidence >= 85) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <div className="bg-white dark:bg-gray-800 border-l-4 border-blue-500 shadow-lg rounded-lg p-4 mb-4 max-w-lg">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <svg className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m0 0h2M3 21h2m-2 0h2M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Company Match Suggestion
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              <strong>Customer:</strong> {match.customerName}
            </p>
            {match.ticketNumber && (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                <strong>Ticket:</strong> #{match.ticketNumber}
              </p>
            )}
            <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <strong>Typed:</strong> "{match.inputCompanyName}"
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                <strong>Suggested:</strong> "{match.suggestedCompany.name}"
              </p>
              <div className="flex items-center mt-2">
                <span className="text-xs font-medium">Confidence:</span>
                <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(match.confidence)}`}>
                  {match.confidence.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
        <button
          onClick={() => onDismiss(match.id)}
          className="flex-shrink-0 text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
          disabled={isProcessing}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div className="flex items-center justify-end space-x-3 mt-4">
        <button
          onClick={handleReject}
          disabled={isProcessing}
          className={`inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
            isProcessing ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Reject
        </button>
        <button
          onClick={handleApprove}
          disabled={isProcessing}
          className={`inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
            isProcessing ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {isProcessing ? 'Processing...' : 'Assign Company'}
        </button>
      </div>
    </div>
  );
};

export default CompanyMatchNotification; 