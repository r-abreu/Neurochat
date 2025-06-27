import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Ticket } from '../../types';
import FileUpload from '../common/FileUpload';

interface ServiceWorkflowProps {
  ticketId: string;
  deviceSerialNumber?: string;
  onClose: () => void;
}

interface WorkflowStep {
  stepId: string;
  stepNumber: number;
  stepName: string;
  stepDescription: string;
  isOptional: boolean;
  status: 'not_started' | 'in_progress' | 'completed' | 'skipped';
  agentId?: string;
  agentName?: string;
  startedAt?: string;
  completedAt?: string;
  definition: any;
  [key: string]: any; // For dynamic step-specific fields
}

// interface Workflow {
//   workflowId: string;
//   ticketId: string;
//   deviceSerialNumber: string;
//   workflowNumber: string;
//   currentStep: number;
//   status: string;
//   steps: WorkflowStep[];
// }

const ServiceWorkflow: React.FC<ServiceWorkflowProps> = ({ ticketId, deviceSerialNumber: propDeviceSerial, onClose }) => {
  const { user, isAuthenticated } = useAuth();
  const { isDarkMode } = useTheme();
  const [workflow, setWorkflow] = useState<any>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<any>({});
  const [isCreating, setIsCreating] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [formData, setFormData] = useState<any>({});
  const [agents, setAgents] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfReports, setPdfReports] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any>({});  // Store attachments per step
  const [uploadingFiles, setUploadingFiles] = useState<any>({});  // Track upload progress

  useEffect(() => {
    if (!isAuthenticated) {
      setCreateError('You must be logged in to access service workflows.');
      setLoading(false);
      return;
    }
    
    loadTicketAndWorkflow();
    loadAgents();
  }, [ticketId, isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load PDF reports when workflow is available
  useEffect(() => {
    if (workflow?.workflowId) {
      loadPdfReports();
    }
  }, [workflow?.workflowId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load attachments when active step changes
  useEffect(() => {
    const currentStepObj = workflow?.steps?.find((s: WorkflowStep) => s.stepNumber === activeStep);
    if (currentStepObj?.stepId && !attachments[currentStepObj.stepId]) {
      loadStepAttachments(currentStepObj.stepId);
    }
  }, [activeStep, workflow?.steps]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadPdfReports = async () => {
    if (!workflow?.workflowId) {
      console.log('⚠️ Cannot load PDF reports: no workflow ID');
      return;
    }
    
    try {
      console.log('🔍 Loading PDF reports for workflow:', workflow.workflowId);
      console.log('🔍 Workflow number:', workflow.workflowNumber);
      console.log('🔍 Full workflow object:', workflow);
      
      const response = await apiService.get(`/service-workflows/${workflow.workflowId}/pdf-reports`);
      console.log('📄 PDF reports response:', response);
      console.log('📄 Response type:', typeof response);
      console.log('📄 Response array length:', Array.isArray(response) ? response.length : 'Not an array');
      
      setPdfReports(response || []);
      console.log('✅ PDF reports loaded successfully, count:', (response || []).length);
    } catch (error: any) {
      console.error('❌ Error loading PDF reports:', error);
      console.error('❌ Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      // Set empty array on error to prevent UI issues
      setPdfReports([]);
    }
  };

  const generatePdfReport = async () => {
    if (!workflow || generatingPdf) return;

    try {
      setGeneratingPdf(true);
      console.log('🔄 Generating PDF report for workflow:', workflow.workflowId);
      console.log('🔍 API Base URL:', process.env.REACT_APP_API_URL || 'http://localhost:3001');
      
      const response = await apiService.post(`/service-workflows/${workflow.workflowId}/generate-pdf-report`, {
        reportType: 'draft'
      });

      console.log('📄 PDF generation response:', response);

      if (response && response.success) {
        console.log('✅ PDF report generated:', response.filename);
        // Show success message to user (remove this alert as we have the table now)
        // alert(`✅ PDF report generated successfully: ${response.filename}`);
        // Reload PDF reports list
        await loadPdfReports();
      } else {
        console.warn('⚠️ PDF generation response indicates failure:', response);
        alert(`⚠️ PDF generation may have failed. Check console for details.`);
      }
    } catch (error: any) {
      console.error('❌ Error generating PDF report:', error);
      console.error('❌ Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        stack: error.stack
      });
      
      // Show error message to user
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error occurred';
      alert(`❌ Error generating PDF report: ${errorMessage}`);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const downloadPdfReport = async (filename: string) => {
    try {
      console.log('📄 Downloading PDF report:', filename);
      
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }
      
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/service-workflows/reports/${filename}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to download report: ${response.status} ${response.statusText}`);
      }

      // Create a blob from the response
      const blob = await response.blob();
      
      // Create a temporary URL for the blob
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary anchor element and trigger download
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      a.target = '_blank'; // Open in new tab as fallback
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);

      console.log('✅ PDF report downloaded successfully');

    } catch (error: any) {
      console.error('❌ Error downloading PDF report:', error);
      const errorMessage = error.message || 'Unknown error occurred';
      alert(`❌ Error downloading PDF report: ${errorMessage}`);
    }
  };

  const deletePdfReport = async (filename: string) => {
    if (!window.confirm(`Are you sure you want to delete the report: ${filename}?`)) {
      return;
    }

    try {
      console.log('🗑️ Deleting PDF report:', filename);
      
      const response = await apiService.delete(`/service-workflows/reports/${filename}`);
      console.log('📄 Delete response:', response);

      if (response && response.success) {
        console.log('✅ PDF report deleted successfully');
        // Reload PDF reports list
        await loadPdfReports();
      } else {
        console.warn('⚠️ PDF deletion response indicates failure:', response);
        alert(`⚠️ Failed to delete report. Check console for details.`);
      }
    } catch (error: any) {
      console.error('❌ Error deleting PDF report:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error occurred';
      alert(`❌ Error deleting PDF report: ${errorMessage}`);
    }
  };

  const loadTicketAndWorkflow = async () => {
    try {
      setLoading(true);
      setCreateError(null);
      
      // Load ticket information first
      console.log('🔍 Loading ticket information for:', ticketId);
      const ticketResponse = await apiService.getTicketById(ticketId);
      console.log('📥 Ticket response:', ticketResponse);
      setTicket(ticketResponse);
      
      // Then load workflow
      await loadWorkflow();
    } catch (error: any) {
      console.error('❌ Error loading ticket and workflow:', error);
      if (error.message.includes('Authentication failed') || error.message.includes('401')) {
        setCreateError('Authentication failed. Please log in again.');
      } else {
        setCreateError('Failed to load ticket and workflow data.');
      }
      setLoading(false);
    }
  };

  const loadWorkflow = async (preserveActiveStep: boolean = false) => {
    try {
      console.log('🔍 Loading workflow for ticket:', ticketId);
      
      const response = await apiService.get(`/tickets/${ticketId}/service-workflows`);
      console.log('📥 Workflow response:', response);
      
      if (response && Array.isArray(response) && response.length > 0) {
        // Load existing workflow
        console.log('✅ Found existing workflow, loading details...');
        const workflowResponse = await apiService.get(`/service-workflows/${response[0].workflowId}`);
        console.log('📋 Workflow details:', workflowResponse);
        
        // Ensure the workflow has a steps array
        const workflow = {
          ...workflowResponse,
          steps: workflowResponse.steps || []
        };
        setWorkflow(workflow);
        
        // Set active step based on workflow's current step, not preserveActiveStep logic
        if (!preserveActiveStep) {
          const workflowCurrentStep = workflow.currentStep || 1;
          console.log('📋 Workflow data:', { 
            workflowId: workflow.workflowId, 
            currentStep: workflow.currentStep, 
            status: workflow.status,
            stepsCount: workflow.steps?.length 
          });
          setActiveStep(workflowCurrentStep);
          console.log('📍 Set active step to:', workflowCurrentStep);
          
          // Initialize form data with current step data
          const currentStepData = workflow?.steps?.find((s: WorkflowStep) => s.stepNumber === workflowCurrentStep);
          if (currentStepData) {
            setFormData(extractStepFormData(currentStepData));
          }
        }
      } else {
        // No workflow exists, show create option
        console.log('📝 No workflow found, showing create option');
        setWorkflow(null);
      }
    } catch (error: any) {
      console.error('❌ Error loading workflow:', error);
      if (error.message.includes('Authentication failed') || error.message.includes('401')) {
        setCreateError('Authentication failed. Please log in again.');
      } else {
        setCreateError('Failed to load workflow data.');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadAgents = async () => {
    try {
      const response = await apiService.getAgents();
      setAgents(response);
      console.log('🔍 Loaded agents for workflow:', response);
    } catch (error) {
      console.error('Error loading agents:', error);
    }
  };

  const createWorkflow = async () => {
    if (!user?.id || isCreating) {
      console.log('🚫 Cannot create workflow - user not authenticated or already creating');
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    console.log('🔧 Creating workflow for ticket:', ticketId);

    try {
      // Get device serial number from props or use default
      const deviceSerialNumber = propDeviceSerial || 'TEMP-001';
      console.log('🔍 Using device serial number:', deviceSerialNumber);
      
      const response = await apiService.post(`/tickets/${ticketId}/service-workflows`, {
        deviceSerialNumber: deviceSerialNumber
      });

      console.log('✅ Workflow creation response:', response);
      
      // Handle both new workflow creation and existing workflow return
      if (response && (response.workflow || response.success)) {
        const workflowData = response.workflow || response;
        
        // Ensure the workflow has a steps array with definitions
        const workflow = {
          ...workflowData,
          steps: workflowData.steps || []
        };
        
        setWorkflow(workflow);
        setCreateError(null);
        
        if (response.message) {
          console.log('📝 Server message:', response.message);
        }
        
        console.log('🎉 Workflow loaded successfully:', workflow.workflowId);
        
        // Set active step and initialize form data
        const workflowCurrentStep = workflow.currentStep || 1;
        setActiveStep(workflowCurrentStep);
        
        // Initialize form data with current step data
        const currentStepData = workflow?.steps?.find((s: WorkflowStep) => s.stepNumber === workflowCurrentStep);
        if (currentStepData) {
          setFormData(extractStepFormData(currentStepData));
        }
      } else {
        console.warn('⚠️ Unexpected response format:', response);
        setCreateError('Invalid workflow response format');
      }
      
    } catch (error: any) {
      console.error('❌ Error creating workflow:', error);
      
      // Extract error message from response
      let errorMessage = 'Failed to create workflow';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }

      // Since the backend should now return existing workflows instead of errors,
      // we shouldn't see the "already exists" error anymore. But keep fallback logic.
      if (errorMessage.includes('Service workflow already exists for this ticket') || 
          errorMessage.includes('already exists')) {
        console.log('🔄 Workflow already exists, loading existing workflow...');
        try {
          // Try to load existing workflows
          await loadWorkflow();
          setCreateError(null);
          console.log('✅ Successfully loaded existing workflow');
          return; // Don't show error if we successfully loaded existing workflow
        } catch (loadError) {
          console.error('❌ Failed to load existing workflow:', loadError);
          errorMessage = 'Workflow already exists but failed to load it';
        }
      }

      setCreateError(errorMessage);
      console.log('🔴 Final error message:', errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const extractStepFormData = (step: WorkflowStep) => {
    const data: any = {};
    
    // Extract all step-specific fields based on step definition
    if (step.definition && step.definition.fields) {
      step.definition.fields.forEach((field: any) => {
        data[field.name] = step[field.name] || '';
      });
    }
    
    return data;
  };

  const handleFormChange = (fieldName: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      [fieldName]: value
    }));
    
    // Clear error for this field
    if (errors[fieldName]) {
      setErrors((prev: any) => ({
        ...prev,
        [fieldName]: null
      }));
    }
  };

  const validateForm = (stepDefinition: any) => {
    const newErrors: any = {};
    
    stepDefinition.fields.forEach((field: any) => {
      const value = formData[field.name];
      
      // Required field validation
      if (field.required === true && (!value || value === '')) {
        newErrors[field.name] = `${field.label} is required`;
      }
      
      // Conditional validation
      if (field.required === 'conditional' && field.dependsOn) {
        const dependentValue = formData[field.dependsOn];
        if (field.dependsOnValue) {
          if (dependentValue === field.dependsOnValue && (!value || value === '')) {
            newErrors[field.name] = `${field.label} is required when ${field.dependsOn} is ${field.dependsOnValue}`;
          }
        } else if (dependentValue && (!value || value === '')) {
          newErrors[field.name] = `${field.label} is required when ${field.dependsOn} is set`;
        }
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const saveStep = async (markCompleted: boolean = false) => {
    const currentStepObj = workflow?.steps.find((s: WorkflowStep) => s.stepNumber === activeStep);
    if (!currentStepObj) return;

    const stepDefinition = currentStepObj.definition;
    if (!validateForm(stepDefinition)) {
      return;
    }

    try {
      setSaving(true);
      
      const updateData = {
        ...formData,
        status: markCompleted ? 'completed' : 'in_progress'
      };

      await apiService.put(`/service-workflows/${workflow?.workflowId}/steps/${currentStepObj.stepId}`, updateData);
      
      // Reload workflow to get updated currentStep
      await loadWorkflow(false);
      setIsEditing(false);
      
      // If step was completed and we want to move to next step automatically
      if (markCompleted) {
        // Move to next step if available and not already there
        const nextStep = activeStep + 1;
        if (nextStep <= (workflow?.steps?.length || 0)) {
          setTimeout(() => {
            handleStepClick(nextStep);
          }, 500); // Small delay to allow workflow to update
        }
      }
      
      // The workflow_updated socket event will be emitted by the backend
      // which will automatically update the TicketDetail component
      
    } catch (error) {
      console.error('Error saving step:', error);
    } finally {
      setSaving(false);
    }
  };

  const skipStep = async () => {
    const currentStepObj = workflow?.steps.find((s: WorkflowStep) => s.stepNumber === activeStep);
    if (!currentStepObj || !currentStepObj.isOptional) return;

    try {
      setSaving(true);
      
      await apiService.put(`/service-workflows/${workflow?.workflowId}/steps/${currentStepObj.stepId}`, {
        status: 'skipped'
      });
      
      // Reload workflow to get updated currentStep
      await loadWorkflow(false);
      
      // Note: activeStep will be automatically updated from workflow.currentStep in loadWorkflow
      // The workflow_updated socket event will be emitted by the backend
      // which will automatically update the TicketDetail component
      
    } catch (error) {
      console.error('Error skipping step:', error);
    } finally {
      setSaving(false);
    }
  };

  // Load attachments for a step
  const loadStepAttachments = async (stepId: string) => {
    try {
      const stepAttachments = await apiService.get(`/service-workflows/steps/${stepId}/attachments`);
      setAttachments((prev: any) => ({
        ...prev,
        [stepId]: stepAttachments || []
      }));
    } catch (error) {
      console.error('Error loading step attachments:', error);
      setAttachments((prev: any) => ({
        ...prev,
        [stepId]: []
      }));
    }
  };

  // Handle file upload for a step
  const handleFileUpload = async (stepId: string, fieldName: string, files: FileList) => {
    const fileArray = Array.from(files);
    setUploadingFiles((prev: any) => ({
      ...prev,
      [stepId]: true
    }));

    try {
      const uploadedFiles: any[] = [];
      
      for (const file of fileArray) {
        const formData = new FormData();
        formData.append('attachment', file);

        const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        const response = await fetch(`${baseUrl}/api/service-workflows/${workflow?.workflowId}/steps/${stepId}/attachments`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: formData
        });

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        const result = await response.json();
        uploadedFiles.push(result.attachment);
      }

      // Update attachments state
      setAttachments((prev: any) => ({
        ...prev,
        [stepId]: [...(prev[stepId] || []), ...uploadedFiles]
      }));

      // Update form data with attachment IDs
      const currentAttachmentIds = formData[fieldName] || [];
      const newAttachmentIds = uploadedFiles.map((file: any) => file.attachmentId);
      handleFormChange(fieldName, [...currentAttachmentIds, ...newAttachmentIds]);

    } catch (error) {
      console.error('Error uploading files:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error uploading files: ${errorMessage}`);
    } finally {
      setUploadingFiles((prev: any) => ({
        ...prev,
        [stepId]: false
      }));
    }
  };

  // Download attachment
  const downloadAttachment = async (attachmentId: string, originalName: string) => {
    try {
      console.log('📥 Downloading attachment:', attachmentId);
      
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }
      
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/service-workflows/attachments/${attachmentId}/download`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
      }

      // Create a blob from the response
      const blob = await response.blob();
      
      // Create a temporary URL for the blob
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary anchor element and trigger download
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = originalName;
      a.target = '_blank'; // Open in new tab as fallback
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);

      console.log('✅ Attachment downloaded successfully');

    } catch (error: any) {
      console.error('❌ Error downloading attachment:', error);
      const errorMessage = error.message || 'Unknown error occurred';
      alert(`❌ Error downloading attachment: ${errorMessage}`);
    }
  };

  // Remove attachment
  const removeAttachment = async (stepId: string, attachmentId: string, fieldName: string) => {
    try {
      await apiService.delete(`/service-workflows/attachments/${attachmentId}`);
      
      // Update attachments state
      setAttachments((prev: any) => ({
        ...prev,
        [stepId]: (prev[stepId] || []).filter((att: any) => att.attachmentId !== attachmentId)
      }));

      // Update form data
      const currentAttachmentIds = formData[fieldName] || [];
      handleFormChange(fieldName, currentAttachmentIds.filter((id: string) => id !== attachmentId));

    } catch (error) {
      console.error('Error removing attachment:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error removing attachment: ${errorMessage}`);
    }
  };

  const renderField = (field: any) => {
    const value = formData[field.name] || '';
    const error = errors[field.name];
    const isDisabled = !isEditing;

    // Show/hide field based on dependencies
    if (field.dependsOn) {
      const dependentValue = formData[field.dependsOn];
      if (field.dependsOnValue && dependentValue !== field.dependsOnValue) {
        return null;
      }
      if (!field.dependsOnValue && !dependentValue) {
        return null;
      }
    }

    switch (field.type) {
      case 'text':
        return (
          <div key={field.name} className="mb-3">
            <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
              {field.label}
              {field.required === true && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => handleFormChange(field.name, e.target.value)}
              disabled={isDisabled}
              className={`w-full px-2 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDisabled 
                  ? isDarkMode ? 'bg-gray-800 cursor-not-allowed text-gray-400' : 'bg-gray-50 cursor-not-allowed' 
                  : isDarkMode ? 'bg-gray-800 text-white' : 'bg-white'
              } ${error ? 'border-red-500' : isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

      case 'textarea':
        return (
          <div key={field.name} className="mb-3">
            <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
              {field.label}
              {field.required === true && <span className="text-red-500 ml-1">*</span>}
            </label>
            <textarea
              value={value}
              onChange={(e) => handleFormChange(field.name, e.target.value)}
              disabled={isDisabled}
              rows={3}
              className={`w-full px-2 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical ${
                isDisabled 
                  ? isDarkMode ? 'bg-gray-800 cursor-not-allowed text-gray-400' : 'bg-gray-50 cursor-not-allowed' 
                  : isDarkMode ? 'bg-gray-800 text-white' : 'bg-white'
              } ${error ? 'border-red-500' : isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

      case 'date':
        return (
          <div key={field.name} className="mb-3">
            <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
              {field.label}
              {field.required === true && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="date"
              value={value ? value.split('T')[0] : ''}
              onChange={(e) => handleFormChange(field.name, e.target.value)}
              disabled={isDisabled}
              className={`w-full px-2 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDisabled 
                  ? isDarkMode ? 'bg-gray-800 cursor-not-allowed text-gray-400' : 'bg-gray-50 cursor-not-allowed' 
                  : isDarkMode ? 'bg-gray-800 text-white' : 'bg-white'
              } ${error ? 'border-red-500' : isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

      case 'select':
        let options: any[] = [];
        if (field.options === 'agents') {
          console.log('🔍 Rendering agents dropdown:', agents);
          options = agents.map(agent => ({
            value: agent.id,
            label: `${agent.firstName} ${agent.lastName}`
          }));
          console.log('🔍 Agent options for dropdown:', options);
        } else if (Array.isArray(field.options)) {
          options = field.options;
        }

        return (
          <div key={field.name} className="mb-3">
            <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
              {field.label}
              {field.required === true && <span className="text-red-500 ml-1">*</span>}
            </label>
            <select
              value={value}
              onChange={(e) => handleFormChange(field.name, e.target.value)}
              disabled={isDisabled}
              className={`w-full px-2 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDisabled 
                  ? isDarkMode ? 'bg-gray-800 cursor-not-allowed text-gray-400' : 'bg-gray-50 cursor-not-allowed' 
                  : isDarkMode ? 'bg-gray-800 text-white' : 'bg-white'
              } ${error ? 'border-red-500' : isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}
            >
              <option value="">Select {field.label}</option>
              {options.map((option, index) => (
                <option key={index} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

      case 'boolean':
        return (
          <div key={field.name} className="mb-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={!!value}
                onChange={(e) => handleFormChange(field.name, e.target.checked)}
                disabled={isDisabled}
                className="mr-2 focus:ring-2 focus:ring-blue-500"
              />
              <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {field.label}
                {field.required === true && <span className="text-red-500 ml-1">*</span>}
              </span>
            </label>
            {field.labels && (
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-1`}>
                {value ? field.labels.true : field.labels.false}
              </p>
            )}
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

      case 'number':
        return (
          <div key={field.name} className="mb-3">
            <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
              {field.label}
              {field.required === true && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="number"
              value={value}
              onChange={(e) => handleFormChange(field.name, e.target.value)}
              disabled={isDisabled}
              className={`w-full px-2 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDisabled 
                  ? isDarkMode ? 'bg-gray-800 cursor-not-allowed text-gray-400' : 'bg-gray-50 cursor-not-allowed' 
                  : isDarkMode ? 'bg-gray-800 text-white' : 'bg-white'
              } ${error ? 'border-red-500' : isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

      case 'parts_table':
        return renderPartsTable(field);

      case 'checklist':
        return renderChecklist(field);

      case 'file':
        const currentStepObj = workflow?.steps.find((s: WorkflowStep) => s.stepNumber === activeStep);
        const stepId = currentStepObj?.stepId;
        const stepAttachments = attachments[stepId || ''] || [];
        const isUploading = uploadingFiles[stepId || ''] || false;

        return (
          <div key={field.name} className="mb-3">
            <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
              {field.label}
              {field.required === true && <span className="text-red-500 ml-1">*</span>}
            </label>
            
            {/* File Upload Component */}
            {isEditing && (
              <div className="mb-4">
                <FileUpload
                  onFileSelect={(files) => stepId && handleFileUpload(stepId, field.name, files)}
                  multiple={field.multiple || false}
                  disabled={isUploading}
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx,.zip"
                  maxSize={200 * 1024 * 1024} // 200MB
                  className="mb-2"
                />
                {isUploading && (
                  <p className="text-blue-500 text-sm">Uploading files...</p>
                )}
              </div>
            )}

            {/* Display uploaded files */}
            {stepAttachments.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">Uploaded Files:</p>
                {stepAttachments.map((attachment: any) => (
                  <div
                    key={attachment.attachmentId}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded border"
                  >
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-sm text-gray-700">{attachment.originalName}</span>
                      <span className="text-xs text-gray-500">
                        ({(attachment.fileSize / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => downloadAttachment(attachment.attachmentId, attachment.originalName)}
                        className="text-blue-500 hover:text-blue-700 text-sm"
                      >
                        Download
                      </button>
                      {isEditing && (
                        <button
                          onClick={() => stepId && removeAttachment(stepId, attachment.attachmentId, field.name)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          </div>
        );

      default:
        return null;
    }
  };

  const renderPartsTable = (field: any) => {
    const parts = formData[field.name] || [];
    const error = errors[field.name];

    const addPart = () => {
      const newPart: any = {};
      field.schema.forEach((schemaField: any) => {
        newPart[schemaField.name] = '';
      });
      
      handleFormChange(field.name, [...parts, newPart]);
    };

    const updatePart = (index: number, partField: string, value: any) => {
      const updatedParts = [...parts];
      updatedParts[index][partField] = value;
      handleFormChange(field.name, updatedParts);
    };

    const removePart = (index: number) => {
      const updatedParts = parts.filter((_: any, i: number) => i !== index);
      handleFormChange(field.name, updatedParts);
    };

    return (
      <div key={field.name} className="mb-3">
        <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
          {field.label}
          {field.required === true && <span className="text-red-500 ml-1">*</span>}
        </label>
        
        <div className={`border rounded-md ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}>
          {parts.length === 0 ? (
            <div className={`p-4 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              No parts added yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <tr>
                    {field.schema.map((schemaField: any) => (
                      <th key={schemaField.name} className={`px-4 py-2 text-left text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {schemaField.label}
                      </th>
                    ))}
                    <th className={`px-4 py-2 text-left text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {parts.map((part: any, index: number) => (
                    <tr key={index} className="border-t">
                      {field.schema.map((schemaField: any) => (
                        <td key={schemaField.name} className="px-4 py-2">
                          <input
                            type={schemaField.type}
                            value={part[schemaField.name] || ''}
                            onChange={(e) => updatePart(index, schemaField.name, e.target.value)}
                            disabled={!isEditing}
                            className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                      ))}
                      <td className="px-4 py-2">
                        {isEditing && (
                          <button
                            onClick={() => removePart(index)}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        {isEditing && (
          <button
            onClick={addPart}
            className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
          >
            Add {field.label.slice(0, -1)}
          </button>
        )}
        
        {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
      </div>
    );
  };

  const renderChecklist = (field: any) => {
    const checklist = formData[field.name] || {};
    const error = errors[field.name];

    return (
      <div key={field.name} className="mb-3">
        <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
          {field.label}
          {field.required === true && <span className="text-red-500 ml-1">*</span>}
        </label>
        
        <div className={`space-y-2 border rounded-md p-3 ${isDarkMode ? 'border-gray-600 bg-gray-800' : 'border-gray-300 bg-white'}`}>
          {field.items.map((item: any) => (
            <label key={item.name} className="flex items-center">
              <input
                type="checkbox"
                checked={!!checklist[item.name]}
                onChange={(e) => handleFormChange(field.name, {
                  ...checklist,
                  [item.name]: e.target.checked
                })}
                disabled={!isEditing}
                className="mr-2 focus:ring-2 focus:ring-blue-500"
              />
              <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{item.label}</span>
            </label>
          ))}
        </div>
        
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      </div>
    );
  };

  const handleStepClick = (stepNumber: number) => {
    if (!isEditing) {
      setActiveStep(stepNumber);
      const stepData = workflow?.steps.find((s: WorkflowStep) => s.stepNumber === stepNumber);
      if (stepData) {
        setFormData(extractStepFormData(stepData));
      }
    }
  };

  const startEditing = () => {
    setIsEditing(true);
    const currentStepObj = workflow?.steps.find((s: WorkflowStep) => s.stepNumber === activeStep);
    if (currentStepObj) {
      setFormData(extractStepFormData(currentStepObj));
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setErrors({});
    const currentStepObj = workflow?.steps.find((s: WorkflowStep) => s.stepNumber === activeStep);
    if (currentStepObj) {
      setFormData(extractStepFormData(currentStepObj));
    }
  };

  // Function to get detailed step instructions
  const getStepInstructions = (stepNumber: number): string => {
    const instructions = {
      1: "📦 Start the repair process by confirming the device serial number, collecting a description of the issue, and entering the shipping tracking number provided by the customer.",
      2: "🚚 If a loaner device will be sent, enter the model and serial number of the loaner, as well as the tracking information for the shipment. Skip this step if no loaner is being provided.",
      3: "🧼 Record when the device arrived. Log any components received, inspect the unit's condition, confirm the product ID, and record the cleaning date.",
      4: "🔍 Analyze the device to identify the root cause of the issue. Record the defect findings and list any parts that will need to be replaced.\n🛑 For technical specifications of components and diagnostics, please refer to the Device Master Records:\nhttps://netorg277030.sharepoint.com/sites/NeurovirtualTechnicalFiles",
      5: "💰 Send the customer a repair quote and wait for approval. Log the quote number, date sent, and approval date. If applicable, also include the invoice number.",
      6: "🛠️ Describe the repairs performed and confirm the list of replaced parts. Complete the functional checklist to verify that the device passed all tests.\n🛑 Refer to the Device Master Records for assembly procedures, required materials, and test specifications:\nhttps://netorg277030.sharepoint.com/sites/NeurovirtualTechnicalFiles",
      7: "✅ Review all information and testing results. If everything is correct, approve the service. This step must be done by a different agent from the repair technician.",
      8: "📤 Ship the repaired device back to the customer. Record the shipment date and tracking number, and add any relevant notes about the return.",
      9: "☎️ Contact the customer to confirm the device was received and is working properly. Record the contact person's name and any customer feedback.",
      10: "📦 Once the customer has returned the loaner device, record the tracking number and date it was received back, along with the responsible agent."
    };
    
    return instructions[stepNumber as keyof typeof instructions] || "";
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading service workflow...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show authentication error if not authenticated
  if (!isAuthenticated && !loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Authentication Required
            </h3>
            <p className="text-gray-600 mb-6">
              You must be logged in to access service workflows.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!workflow || !workflow.steps) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 max-w-md w-full mx-4`}>
          <div className="text-center">
            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-4`}>
              No Service Workflow Found
            </h3>
            <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-6`}>
              This ticket doesn't have a service workflow yet. Would you like to create one?
            </p>
            {createError && (
              <div className={`${isDarkMode ? 'bg-red-900 border-red-700 text-red-300' : 'bg-red-100 border-red-400 text-red-700'} border px-4 py-3 rounded mb-4`}>
                <p className="text-sm">{createError}</p>
              </div>
            )}
            <div className="flex space-x-3 justify-center">
              <button
                onClick={onClose}
                className={`px-4 py-2 ${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-800'} transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={createWorkflow}
                disabled={isCreating}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {isCreating ? 'Creating...' : 'Create Workflow'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentStepObj = workflow?.steps?.find((s: WorkflowStep) => s.stepNumber === activeStep);
  const canEdit = currentStepObj && (
    currentStepObj.status === 'in_progress' || 
    currentStepObj.status === 'not_started' || 
    currentStepObj.status === 'completed' ||
    (currentStepObj.status === 'skipped' && (currentStepObj.stepNumber === 2 || currentStepObj.stepNumber === 10))
  );
  const isCompleted = currentStepObj?.status === 'completed';
  const isSkipped = currentStepObj?.status === 'skipped';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-2">
      <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg p-4 w-full max-w-[98vw] xl:max-w-[95vw] 2xl:max-w-[90vw] max-h-[95vh] overflow-y-auto`}>
        <div className="flex justify-between items-center mb-4">
          <div className="flex-1">
            <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-1`}>
              Service Workflow - {workflow.workflowNumber}
            </h2>
            <div className="flex flex-wrap gap-4 text-sm">
              <span className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Device: {workflow.deviceSerialNumber}
              </span>
              <span className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Ticket: {ticket?.ticketNumber}
              </span>
              <span className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Status: <span className="capitalize">{workflow.status}</span>
              </span>
              <span className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Step: {workflow.currentStep || 1} / {workflow?.steps?.length || 10}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`${isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'} transition-colors flex-shrink-0 ml-4`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Wizard Stepper */}
        <div className="mb-6">
          <div className="w-full px-2">
            <div className="flex items-stretch w-full min-h-[60px] wizard-stepper-container">
              {workflow?.steps?.map((step: WorkflowStep, index: number) => {
                const isActive = step.stepNumber === activeStep;
                const isCompleted = step.status === 'completed';
                const isSkipped = step.status === 'skipped';
                const isInProgress = step.status === 'in_progress';
                const isLast = index === workflow.steps.length - 1;
                const isFirst = index === 0;
                
                return (
                  <div 
                    key={step.stepNumber} 
                    className="flex items-stretch flex-1"
                  >
                    <div className="relative w-full">
                      <button
                        onClick={() => handleStepClick(step.stepNumber)}
                        className={`
                          relative flex items-center px-2 py-2 text-xs font-medium transition-all duration-200 cursor-pointer
                          w-full min-h-[60px] shadow-sm
                          ${isCompleted 
                            ? 'bg-green-500 text-white hover:bg-green-600' 
                            : isActive || isInProgress
                            ? 'bg-blue-500 text-white hover:bg-blue-600'
                            : isSkipped
                            ? 'bg-gray-400 text-white hover:bg-gray-500'
                            : isDarkMode
                            ? 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }
                          ${!isLast ? 'clip-path-chevron' : 'rounded-r-md'}
                          ${isFirst ? 'rounded-l-md' : ''}
                        `}
                        style={{
                          clipPath: !isLast 
                            ? 'polygon(0 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 0 100%, 16px 50%)'
                            : !isFirst 
                            ? 'polygon(16px 0, 100% 0, 100% 100%, 16px 100%, 0 50%)'
                            : 'none',
                          marginLeft: !isFirst ? '-1px' : '0'
                        }}
                      >
                        <div className="flex items-center relative z-10 w-full">
                          {/* Step Content - Centered with proper spacing for chevron */}
                          <div className="text-center flex-1 px-4">
                            <div 
                              className="font-medium text-[10px] leading-tight break-words hyphens-auto"
                              style={{ 
                                overflowWrap: 'break-word',
                                wordBreak: 'break-word',
                                lineHeight: '1.2',
                                marginRight: !isLast ? '20px' : '0'
                              }}
                              title={step.stepName}
                            >
                              {step.stepName}
                            </div>
                          </div>
                          
                          {/* Step Number Circle - Positioned absolutely to avoid layout conflicts */}
                          <div 
                            className={`
                              absolute top-1/2 transform -translate-y-1/2 
                              flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold
                              ${isCompleted || isActive || isInProgress || isSkipped
                                ? 'bg-white'
                                : isDarkMode ? 'bg-gray-700' : 'bg-white'
                              }
                              ${isCompleted 
                                ? 'text-green-500' 
                                : isActive || isInProgress
                                ? 'text-blue-500'
                                : isSkipped
                                ? 'text-gray-400'
                                : isDarkMode ? 'text-gray-300' : 'text-gray-600'
                              }
                            `}
                            style={{
                              right: !isLast ? '8px' : '0px'
                            }}
                          >
                            {isCompleted ? (
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            ) : isSkipped ? (
                              <span>–</span>
                            ) : (
                              step.stepNumber
                            )}
                          </div>
                        </div>
                      </button>
                      
                      {/* Optional Badge */}
                      {step.isOptional && (
                        <div className="absolute -top-1 -right-1 bg-yellow-400 text-yellow-900 text-[9px] px-1 py-0.5 rounded-full font-medium z-20">
                          Opt
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Active Step Content */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 min-h-[400px]">
          {/* Left Column - Step Info and Instructions */}
          <div className="xl:col-span-1">
            <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg p-4 h-full`}>
              <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-2`}>
                Step {activeStep}: {currentStepObj?.stepName}
              </h3>
              
              <div className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} text-sm mb-3`}>
                {currentStepObj?.stepDescription}
              </div>
              
              {/* Status indicators - Fixed height container */}
              <div className="mb-3 h-10 flex items-start">
                {isCompleted && (
                  <div className={`${isDarkMode ? 'bg-green-900 border-green-700 text-green-300' : 'bg-green-100 border-green-400 text-green-700'} border px-3 py-2 rounded text-sm`}>
                    ✓ Completed
                  </div>
                )}
                
                {isSkipped && (
                  <div className={`${isDarkMode ? 'bg-yellow-900 border-yellow-700 text-yellow-300' : 'bg-yellow-100 border-yellow-400 text-yellow-700'} border px-3 py-2 rounded text-sm`}>
                    ⤴ Skipped
                  </div>
                )}
              </div>

              {/* Condensed Step Instructions */}
              <details className="group">
                <summary className={`${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'} cursor-pointer text-sm font-medium mb-2`}>
                  View Instructions
                </summary>
                <div className={`${isDarkMode ? 'bg-blue-900 border-blue-700 text-blue-200' : 'bg-blue-50 border-blue-200 text-gray-700'} border rounded-lg p-3 text-sm`}>
                  <div className="whitespace-pre-line">
                    {getStepInstructions(activeStep).split('\n').map((line, index) => (
                      <div key={index} className="mb-1 last:mb-0 text-xs">
                        {line.includes('https://') ? (
                          <span>
                            {line.split('https://')[0]}
                            <a 
                              href={`https://${line.split('https://')[1]}`}
                              target="_blank" 
                              rel="noopener noreferrer"
                              className={`${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'} underline`}
                            >
                              https://{line.split('https://')[1]}
                            </a>
                          </span>
                        ) : (
                          line
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            </div>
          </div>

          {/* Right Column - Form Fields and Actions */}
          <div className="xl:col-span-2">
            <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-white'} rounded border p-4 h-full flex flex-col`}>
              {/* Action Buttons - Fixed height container */}
              <div className="flex flex-wrap gap-2 mb-4 min-h-[40px] items-start">
                {canEdit && !isEditing && (
                  <button
                    onClick={startEditing}
                    className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
                  >
                    Edit
                  </button>
                )}
                
                {isEditing && (
                  <>
                    <button
                      onClick={cancelEditing}
                      className={`px-3 py-1.5 text-sm ${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-800'} transition-colors`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => saveStep(false)}
                      disabled={saving}
                      className="px-3 py-1.5 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition-colors disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => saveStep(true)}
                      disabled={saving}
                      className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors disabled:opacity-50"
                    >
                      {saving ? 'Completing...' : 'Done & Next'}
                    </button>
                    {currentStepObj?.isOptional && (
                      <button
                        onClick={skipStep}
                        disabled={saving}
                        className="px-3 py-1.5 bg-gray-500 text-white text-sm rounded hover:bg-gray-600 transition-colors disabled:opacity-50"
                      >
                        {saving ? 'Skipping...' : 'Skip'}
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Step Form Fields - Flexible content area */}
              <div className="flex-1">
                {currentStepObj?.definition?.fields ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {currentStepObj.definition.fields.map((field: any) => renderField(field))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32">
                    <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'} text-center text-sm`}>
                      No fields defined for this step
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* PDF Reports Table - Show on all steps when workflow exists */}
        {workflow && (
          <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-white'} rounded border p-4 mt-4`}>
            <details className="group">
              <summary className={`${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'} cursor-pointer text-sm font-medium mb-2 flex items-center justify-between`}>
                <span>Generated Reports ({pdfReports.length})</span>
                <div className="flex gap-2">
                  <button
                    onClick={loadPdfReports}
                    className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
                  >
                    Reload
                  </button>
                  <button
                    onClick={generatePdfReport}
                    disabled={generatingPdf || (workflow?.currentStep || 1) < 6}
                    className={`px-2 py-1 text-white text-xs rounded transition-colors disabled:opacity-50 ${
                      (workflow?.currentStep || 1) >= 6 
                        ? 'bg-purple-500 hover:bg-purple-600' 
                        : 'bg-gray-400 cursor-not-allowed'
                    }`}
                    title={(workflow?.currentStep || 1) < 6 ? 'Report generation available from step 6 onwards' : 'Generate new service report'}
                  >
                    {generatingPdf ? 'Generating...' : 'Generate'}
                  </button>
                </div>
              </summary>
              
              {pdfReports.length > 0 ? (
                <div className="overflow-x-auto mt-3">
                  <table className="min-w-full table-auto text-xs">
                    <thead>
                      <tr className={`${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                        <th className={`px-2 py-1 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase`}>Type</th>
                        <th className={`px-2 py-1 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase`}>Date</th>
                        <th className={`px-2 py-1 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase`}>File</th>
                        <th className={`px-2 py-1 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase`}>Size</th>
                        <th className={`px-2 py-1 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className={`${isDarkMode ? 'divide-gray-600' : 'divide-gray-200'} divide-y`}>
                      {pdfReports.map((report, index) => (
                        <tr key={index} className={`${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-50'}`}>
                          <td className="px-2 py-1 text-xs">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${isDarkMode ? 'bg-purple-900 text-purple-200' : 'bg-purple-100 text-purple-800'}`}>
                              {report.reportType || 'Draft'}
                            </span>
                          </td>
                          <td className="px-2 py-1 text-xs">
                            <div className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                              {new Date(report.createdAt).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-2 py-1 text-xs">
                            <div className={`font-mono ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} truncate max-w-40`}>
                              {report.filename}
                            </div>
                          </td>
                          <td className="px-2 py-1 text-xs">
                            <div className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {report.formattedSize || `${Math.round(report.size / 1024)} KB`}
                            </div>
                          </td>
                          <td className="px-2 py-1 text-xs">
                            <div className="flex gap-1">
                              <button
                                onClick={() => downloadPdfReport(report.filename)}
                                className={`${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'} underline`}
                              >
                                Open
                              </button>
                              <button
                                onClick={() => deletePdfReport(report.filename)}
                                className={`${isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-800'}`}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={`text-center py-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} text-sm`}>
                  <p>No reports generated yet</p>
                </div>
              )}
            </details>
          </div>
        )}

        {/* Step Navigation */}
        <div className="flex justify-between items-center mt-4">
          <button
            onClick={() => {
              if (activeStep > 1) {
                handleStepClick(activeStep - 1);
              }
            }}
            disabled={activeStep <= 1 || isEditing}
            className={`px-3 py-1.5 text-sm ${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-800'} transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            ← Previous
          </button>

          <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Step {activeStep} / {workflow?.steps?.length || 0}
          </div>

          <button
            onClick={() => {
              if (activeStep < (workflow?.steps?.length || 0)) {
                handleStepClick(activeStep + 1);
              }
            }}
            disabled={activeStep >= (workflow?.steps?.length || 0) || isEditing}
            className={`px-3 py-1.5 text-sm ${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-800'} transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceWorkflow; 