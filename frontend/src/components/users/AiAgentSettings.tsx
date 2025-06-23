import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';

interface AiAgentConfig {
  id: string;
  model: string;
  agent_name: string;
  response_tone: string;
  attitude_style: string;
  context_limitations: string;
  exceptions_behavior: string;
  confidence_threshold: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AiDocument {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  chunkCount: number;
  isActive: boolean;
  createdAt: string;
  preview: string;
}

interface AiStats {
  totalResponses: number;
  responsesLast24h: number;
  responsesLast7Days: number;
  averageConfidence: number;
  averageResponseTime: number;
  escalationRate: number;
  documentsCount: number;
  chunksCount: number;
  ticketsWithAiDisabled: number;
}

const AiAgentSettings: React.FC = () => {
  const { user } = useAuth();
  const [config, setConfig] = useState<AiAgentConfig | null>(null);
  const [documents, setDocuments] = useState<AiDocument[]>([]);
  const [stats, setStats] = useState<AiStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadProgress, setUploadProgress] = useState<string>('');

  const hasAiSettingsPermission = user?.permissions?.includes('system.ai_settings');

  const modelOptions = [
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-4-0613', label: 'GPT-4 (June 13)' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-4o', label: 'GPT-4o (Default)' }
  ];

  const toneOptions = [
    'Technical', 'Friendly', 'Formal', 'Empathetic', 'Professional', 'Casual'
  ];

  const attitudeOptions = [
    'Curious', 'Calm', 'Assertive', 'Supportive', 'Analytical', 'Patient'
  ];

  useEffect(() => {
    if (hasAiSettingsPermission) {
      loadData();
    }
  }, [hasAiSettingsPermission]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [configData, documentsData, statsData] = await Promise.all([
        apiService.getAiAgentConfig(),
        apiService.getAiDocuments(),
        apiService.getAiStats()
      ]);
      
      setConfig(configData);
      setDocuments(documentsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading AI agent data:', error);
      setMessage('Error loading AI agent settings');
    } finally {
      setLoading(false);
    }
  };

  const handleConfigChange = (field: keyof AiAgentConfig, value: any) => {
    if (!config) return;
    
    setConfig({
      ...config,
      [field]: value
    });
  };

  const saveConfig = async () => {
    if (!config) return;
    
    setSaving(true);
    try {
      const updatedConfig = await apiService.updateAiAgentConfig(config);
      setConfig(updatedConfig);
      setMessage('AI agent configuration saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error saving AI config:', error);
      setMessage('Failed to save AI agent configuration.');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Validate file types and sizes
    const allowedTypes = ['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx', 'csv'];
    const maxSize = 200 * 1024 * 1024; // 200MB
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      
      if (!fileExtension || !allowedTypes.includes(fileExtension)) {
        setMessage(`File "${file.name}" has an unsupported format. Please upload PDF, DOC, DOCX, TXT, XLS, XLSX, or CSV files.`);
        setTimeout(() => setMessage(''), 3000);
        return;
      }

      if (file.size > maxSize) {
        setMessage(`File "${file.name}" is too large. Maximum size is 200MB.`);
        setTimeout(() => setMessage(''), 3000);
        return;
      }
    }

    setUploading(true);
    setUploadProgress(`Uploading ${files.length} file${files.length > 1 ? 's' : ''}...`);

    try {
      const result = await apiService.uploadAiDocuments(files);
      
      // Add successfully uploaded documents
      if (result.uploadedDocuments && result.uploadedDocuments.length > 0) {
        setDocuments(prev => [...prev, ...result.uploadedDocuments]);
        
        // Reload stats to reflect new documents
        const updatedStats = await apiService.getAiStats();
        setStats(updatedStats);
      }

      // Show results
      let message = '';
      if (result.uploadedDocuments && result.uploadedDocuments.length > 0) {
        message += `Successfully uploaded ${result.uploadedDocuments.length} document${result.uploadedDocuments.length > 1 ? 's' : ''}: ${result.uploadedDocuments.map((doc: any) => doc.fileName).join(', ')}`;
      }
      
      if (result.failedDocuments && result.failedDocuments.length > 0) {
        if (message) message += '\n\n';
        message += `Failed to upload ${result.failedDocuments.length} document${result.failedDocuments.length > 1 ? 's' : ''}:\n`;
        result.failedDocuments.forEach((failed: any) => {
          message += `- ${failed.fileName}: ${failed.errors.join(', ')}\n`;
        });
      }

      setMessage(message || 'Upload completed');
      setTimeout(() => setMessage(''), 5000);
    } catch (error) {
      console.error('Error uploading documents:', error);
      setMessage('Failed to upload documents. Please try again.');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setUploading(false);
      setUploadProgress('');
      // Reset file input
      event.target.value = '';
    }
  };

  const deleteDocument = async (documentId: string) => {
    if (!window.confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return;
    }

    try {
      await apiService.deleteAiDocument(documentId);
      setDocuments(prev => prev.filter(doc => doc.id !== documentId));
      
      // Reload stats
      const updatedStats = await apiService.getAiStats();
      setStats(updatedStats);
      
      setMessage('Document deleted successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error deleting document:', error);
      setMessage('Failed to delete document.');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatPercentage = (value: number): string => {
    return (value * 100).toFixed(1) + '%';
  };

  const setDefaultTechnicalSupportContext = () => {
    const defaultContext = `Role: Technical Support AI Agent (Neurovirtual)
Primary Objective:
You are a professional, helpful, and secure AI assistant that provides technical support for Neurovirtual products. You assist users by answering questions, guiding through troubleshooting steps, and escalating issues when necessary—all while ensuring a safe, focused, and friendly interaction.

🎯 Supported Products
Devices: BWMini, BWIII
Software: BWAnalysis, BWCenter

Always begin by identifying the product in question:
"Is your question related to one of our devices (BWMini or BWIII), or our software (BWAnalysis or BWCenter)?"

💬 User Interaction Guidelines
Ask one question or provide one instruction at a time.
Avoid overwhelming the user.

For multi-step processes (3+ steps):
- Provide the steps gradually.
- Ask for user confirmation after each step before continuing.

If the user stops responding, wait 15 seconds, then ask:
"Just checking — did that help, or would you like more guidance?"

Maintain professionalism and end each interaction with a positive tone.

🔧 Special Case Handling
🚫 Device Appears Damaged
Ask: "Would you like to try a few troubleshooting steps to confirm if the device is damaged?"

If the user is certain the device is defective:
Ask for the serial number: "Please provide the device's serial number so I can escalate the issue to our support team."
After receiving the serial number, escalate appropriately.

⚠️ Sensor Not Working
Refer the user to the relevant troubleshooting or learning documentation.
If the issue persists or documentation does not resolve it, escalate the case.

💵 Request for Quote or Pricing
Do not provide any pricing directly. Instead, refer the user to sales:
"For pricing or quotes, please contact our sales team through this link: https://neurovirtual.com/technicalsupport/"

🔐 Data Safety & Support Protocols
No Mention of Training Data
Never reference internal or external data sources.

Request Serial Number Only When Required
Only ask for serial numbers in the case of hardware escalation.

Do Not Request or Retain Personal Data
Avoid asking for names, email addresses, or contact details unless required by support escalation protocol.

Stay Within Scope
If a user asks something unrelated to Neurovirtual devices or software, respond with:
"I'm here to help with Neurovirtual hardware and software. For anything outside this scope, please contact our team directly."

Graceful Fallback
If you cannot answer:
"I couldn't find the information in my support materials. I recommend reaching out to our support team directly for further help."

✅ Support Flow Summary
1. Identify the product (BWMini, BWIII, BWAnalysis, or BWCenter).
2. Guide using one question or instruction at a time.
3. For multi-step processes, give steps in parts, wait for confirmation.
4. If user disengages, follow up once after 15 seconds.
5. If device is defective, request the serial number, then escalate.
6. Refer pricing requests to sales.
7. For sensor issues, offer docs first, escalate if unresolved.
8. Never expose or retain personal or internal data.`;

    handleConfigChange('context_limitations', defaultContext);
    handleConfigChange('exceptions_behavior', 'warranty,refund,billing,escalate,human,pricing,sales,personal_data,quote,price');
    setMessage('Default technical support context and escalation keywords loaded successfully!');
    setTimeout(() => setMessage(''), 3000);
  };

  if (!hasAiSettingsPermission) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Access Denied
              </h3>
              <p className="mt-2 text-sm text-red-700 dark:text-red-300">
                You do not have permission to access AI agent settings. Please contact your administrator for the required permissions.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
          <span className="mr-3">🤖</span>
          AI Agent Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400">Configure the AI agent behavior and knowledge base</p>
      </div>

      {message && (
        <div className={`mb-4 p-4 rounded-md ${message.includes('success') 
          ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800' 
          : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
        }`}>
          {message}
        </div>
      )}

      {/* AI Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Responses</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalResponses}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Confidence</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatPercentage(stats.averageConfidence)}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                <svg className="h-6 w-6 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Escalation Rate</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatPercentage(stats.escalationRate)}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <svg className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Knowledge Base</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.documentsCount}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* AI Configuration */}
        {config && (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">AI Agent Configuration</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Global AI Toggle */}
              <div className="md:col-span-2">
                <div className="flex items-center">
                  <input
                    id="ai-enabled"
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(e) => handleConfigChange('enabled', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="ai-enabled" className="ml-2 block text-sm text-gray-900 dark:text-white font-medium">
                    Enable AI Agent Globally
                  </label>
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  When enabled, AI will automatically respond to new customer messages
                </p>
              </div>

              {/* Model Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  AI Model
                </label>
                <select
                  value={config.model}
                  onChange={(e) => handleConfigChange('model', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  {modelOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Agent Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Agent Name
                </label>
                <input
                  type="text"
                  value={config.agent_name}
                  onChange={(e) => handleConfigChange('agent_name', e.target.value)}
                  placeholder="NeuroAI"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Response Tone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Response Tone
                </label>
                <select
                  value={config.response_tone}
                  onChange={(e) => handleConfigChange('response_tone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  {toneOptions.map(tone => (
                    <option key={tone} value={tone}>{tone}</option>
                  ))}
                </select>
              </div>

              {/* Attitude Style */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Attitude Style
                </label>
                <select
                  value={config.attitude_style}
                  onChange={(e) => handleConfigChange('attitude_style', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  {attitudeOptions.map(attitude => (
                    <option key={attitude} value={attitude}>{attitude}</option>
                  ))}
                </select>
              </div>

              {/* Confidence Threshold */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Confidence Threshold ({(config.confidence_threshold * 100).toFixed(0)}%)
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.1"
                  value={config.confidence_threshold}
                  onChange={(e) => handleConfigChange('confidence_threshold', parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  When AI confidence is below this threshold, the ticket will be escalated to a human agent
                </p>
              </div>

              {/* Context Limitations */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Technical Support Context & Guidelines
                  </label>
                  <button
                    type="button"
                    onClick={setDefaultTechnicalSupportContext}
                    className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 shadow-sm text-xs font-medium rounded text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Load Default Context
                  </button>
                </div>
                <textarea
                  value={config.context_limitations}
                  onChange={(e) => handleConfigChange('context_limitations', e.target.value)}
                  rows={16}
                  placeholder="Define the AI agent's role, guidelines, and behavioral context..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                />
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  This context defines how the AI agent should behave, what products it supports, and how it should handle different scenarios. 
                  Use the "Load Default Context" button to apply the comprehensive Neurovirtual technical support guidelines.
                </p>
              </div>

              {/* Exception Behavior */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Escalation Keywords
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      handleConfigChange('exceptions_behavior', 'warranty,refund,billing,escalate,human,pricing,sales,personal_data,quote,price');
                      setMessage('Default escalation keywords loaded!');
                      setTimeout(() => setMessage(''), 3000);
                    }}
                    className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 shadow-sm text-xs font-medium rounded text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Load Defaults
                  </button>
                </div>
                <input
                  type="text"
                  value={config.exceptions_behavior}
                  onChange={(e) => handleConfigChange('exceptions_behavior', e.target.value)}
                  placeholder="warranty,refund,billing,escalate,human,pricing,sales,personal_data"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Comma-separated keywords that trigger immediate escalation to human agents. Keywords like "pricing", "quote", "warranty", "refund" will automatically escalate to ensure proper handling.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={saveConfig}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        )}

        {/* Knowledge Base Management */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Knowledge Base Documents</h3>
            <div className="flex items-center space-x-4">
              {uploading && (
                <span className="text-sm text-blue-600 dark:text-blue-400">{uploadProgress}</span>
              )}
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.csv"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  multiple
                  className="hidden"
                />
                <span className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50">
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload Documents
                </span>
              </label>
            </div>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Upload support documents (PDF, DOC, DOCX, TXT, XLS, XLSX, CSV) to enhance AI responses. Max file size: 200MB.
          </p>

          <div className="space-y-3">
            {documents.length === 0 ? (
              <div className="text-center py-8">
                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No documents uploaded</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Upload your first support document to get started.</p>
              </div>
            ) : (
              documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <svg className="h-5 w-5 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{doc.fileName}</span>
                      <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {doc.fileType.toUpperCase()}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {formatBytes(doc.fileSize)} • {doc.chunkCount} chunks • {new Date(doc.createdAt).toLocaleDateString()}
                    </div>
                    <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                      {doc.preview}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteDocument(doc.id)}
                    className="ml-4 p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiAgentSettings;
