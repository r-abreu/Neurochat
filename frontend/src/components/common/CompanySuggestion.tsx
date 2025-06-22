import React from 'react';

interface CompanySuggestionProps {
  suggestions: Array<{
    name: string;
    confidence: number;
    description?: string;
  }>;
  onSelect: (companyName: string) => void;
  onDismiss: () => void;
}

const CompanySuggestion: React.FC<CompanySuggestionProps> = ({ suggestions, onSelect, onDismiss }) => {
  if (suggestions.length === 0) return null;

  return (
    <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Company Suggestions
          </span>
          <button
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      
      <div className="py-1">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onSelect(suggestion.name)}
            className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-700"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {suggestion.name}
                </div>
                {suggestion.description && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {suggestion.description}
                  </div>
                )}
              </div>
              <div className="ml-2">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  suggestion.confidence >= 90 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : suggestion.confidence >= 75
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                }`}>
                  {suggestion.confidence.toFixed(0)}%
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
      
      <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
        Click on a suggestion to select it, or continue typing to add a new company.
      </div>
    </div>
  );
};

export default CompanySuggestion; 