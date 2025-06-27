const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

class ServiceWorkflowService {
  constructor() {
    // Initialize with in-memory storage (replace with actual database calls)
    this.workflows = [];
    this.workflowSteps = [];
    this.workflowAttachments = [];
    this.auditLogs = [];
    
    this.stepDefinitions = [
      {
        stepNumber: 1,
        stepName: 'Request Device for Repair',
        stepDescription: 'Initial device request with tracking and defect description',
        isOptional: false,
        fields: [
          { name: 'deviceSerialNumber', label: 'Service Serial Number', type: 'text', required: true, validation: 'device_exists' },
          { name: 'defectDescription', label: 'Defect Description', type: 'textarea', required: true },
          { name: 'customerTrackingNumber', label: 'Customer Tracking Number', type: 'text', required: true },
          { name: 'assignedAgentId', label: 'Assigned Agent', type: 'select', required: true, options: 'agents' },
          { name: 'requestedDate', label: 'Requested Date', type: 'date', required: true, default: 'today' },
          { name: 'comments', label: 'Comments', type: 'textarea', required: false },
          { name: 'attachments', label: 'Attachments (PDF or image)', type: 'file', required: false, multiple: true }
        ]
      },
      {
        stepNumber: 2,
        stepName: 'Ship Loaner to Customer',
        stepDescription: 'Optional loaner device shipment to customer',
        isOptional: true,
        fields: [
          { name: 'sendLoaner', label: 'Send Loaner Device', type: 'boolean', required: false, default: false },
          { name: 'loanerModel', label: 'Loaner Model', type: 'text', required: 'conditional', dependsOn: 'sendLoaner' },
          { name: 'loanerSerialNumber', label: 'Loaner Serial Number', type: 'text', required: 'conditional', dependsOn: 'sendLoaner' },
          { name: 'loanerTrackingNumber', label: 'Loaner Tracking Number', type: 'text', required: 'conditional', dependsOn: 'sendLoaner' },
          { name: 'shipmentDate', label: 'Shipment Date', type: 'date', required: 'conditional', dependsOn: 'sendLoaner' },
          { name: 'loanerAgentId', label: 'Loaner Agent', type: 'select', required: 'conditional', dependsOn: 'sendLoaner', options: 'agents' },
          { name: 'comments', label: 'Comments', type: 'textarea', required: false },
          { name: 'attachments', label: 'Attachments (shipment label)', type: 'file', required: false, multiple: true }
        ]
      },
      {
        stepNumber: 3,
        stepName: 'Receiving, Inspection & Cleaning',
        stepDescription: 'Device received, inspected, and cleaned',
        isOptional: false,
        fields: [
          { name: 'receivedDate', label: 'Date Received', type: 'date', required: true },
          { name: 'cleaningDate', label: 'Cleaning Date', type: 'date', required: true },
          { name: 'productIdConfirmationDate', label: 'Product ID Confirmation Date', type: 'date', required: true },
          { name: 'inspectionAgentId', label: 'Responsible Agent', type: 'select', required: true, options: 'agents' },
          { name: 'receivedParts', label: 'Received Parts', type: 'parts_table', required: true, 
            schema: [
              { name: 'partModel', label: 'Part Model', type: 'text', required: true },
              { name: 'serialNumber', label: 'Serial Number', type: 'text', required: true },
              { name: 'partName', label: 'Part Name', type: 'text', required: true }
            ]
          },
          { name: 'inspectionComments', label: 'Inspection Comments', type: 'textarea', required: false },
          { name: 'comments', label: 'General Comments', type: 'textarea', required: false },
          { name: 'attachments', label: 'Attachments (inspection photos)', type: 'file', required: false, multiple: true }
        ]
      },
      {
        stepNumber: 4,
        stepName: 'Defect Analysis',
        stepDescription: 'Analysis of device defects and required parts',
        isOptional: false,
        fields: [
          { name: 'analysisDate', label: 'Analysis Date', type: 'date', required: true },
          { name: 'analysisAgentId', label: 'Responsible Agent', type: 'select', required: true, options: 'agents' },
          { name: 'findingsDescription', label: 'Findings Description', type: 'textarea', required: true },
          { name: 'replacementParts', label: 'Replacement Parts', type: 'parts_table', required: true,
            schema: [
              { name: 'partNumber', label: 'Part Number', type: 'text', required: true },
              { name: 'partName', label: 'Part Name', type: 'text', required: true },
              { name: 'quantity', label: 'Quantity', type: 'number', required: true }
            ]
          },
          { name: 'diagnosticSummary', label: 'Diagnostic Summary', type: 'textarea', required: false },
          { name: 'comments', label: 'Comments', type: 'textarea', required: false },
          { name: 'attachments', label: 'Attachments (test logs, photos)', type: 'file', required: false, multiple: true }
        ]
      },
      {
        stepNumber: 5,
        stepName: 'Quote & Approval',
        stepDescription: 'Generate quote and obtain customer approval',
        isOptional: false,
        fields: [
          { name: 'quoteNumber', label: 'Quote Number', type: 'text', required: true },
          { name: 'quoteDate', label: 'Quote Date', type: 'date', required: true },
          { name: 'quoteAgentId', label: 'Responsible Agent', type: 'select', required: true, options: 'agents' },
          { name: 'approvalStatus', label: 'Approval Status', type: 'select', required: true, 
            options: [
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' }
            ]
          },
          { name: 'approvalDate', label: 'Approval Date', type: 'date', required: 'conditional', dependsOn: 'approvalStatus', dependsOnValue: 'approved' },
          { name: 'invoiceNumber', label: 'Invoice Number', type: 'text', required: false },
          { name: 'comments', label: 'Comments', type: 'textarea', required: false },
          { name: 'attachments', label: 'Attachments (quote PDF)', type: 'file', required: false, multiple: true }
        ]
      },
      {
        stepNumber: 6,
        stepName: 'Correction and Technical Report',
        stepDescription: 'Perform repairs and generate service report',
        isOptional: false,
        fields: [
          { name: 'correctionDate', label: 'Correction Date', type: 'date', required: true },
          { name: 'repairAgentId', label: 'Responsible Agent', type: 'select', required: true, options: 'agents' },
          { name: 'repairDescription', label: 'Repair Description', type: 'textarea', required: true },
          { name: 'partsUsed', label: 'Parts Used', type: 'parts_table', required: true,
            schema: [
              { name: 'partNumber', label: 'Part Number', type: 'text', required: true },
              { name: 'partName', label: 'Part Name', type: 'text', required: true },
              { name: 'quantity', label: 'Quantity Used', type: 'number', required: true },
              { name: 'serialNumber', label: 'Serial Number', type: 'text', required: true }
            ]
          },
          { name: 'testChecklist', label: 'Test Checklist', type: 'checklist', required: true,
            items: [
              { name: 'powerTest', label: 'Power Test', type: 'boolean' },
              { name: 'functionalTest', label: 'Functional Test', type: 'boolean' },
              { name: 'calibrationTest', label: 'Calibration Test', type: 'boolean' },
              { name: 'safetyTest', label: 'Safety Test', type: 'boolean' },
              { name: 'finalTest', label: 'Final Comprehensive Test', type: 'boolean' }
            ]
          },
          { name: 'finalRepairApproval', label: 'Final Repair Approval', type: 'boolean', required: true },
          { name: 'comments', label: 'Comments', type: 'textarea', required: false },
          { name: 'attachments', label: 'Attachments (service report, photos)', type: 'file', required: false, multiple: true }
        ]
      },
      {
        stepNumber: 7,
        stepName: 'Repair and Report',
        stepDescription: 'Final service approval by different agent',
        isOptional: false,
        requiresDifferentAgent: true,
        fields: [
          { name: 'approverAgentId', label: 'Approver Agent', type: 'select', required: true, options: 'agents', validation: 'different_from_step6' },
          { name: 'approvalDate', label: 'Approval Date', type: 'date', required: true },
          { name: 'approvalDeclaration', label: 'I certify this service is complete and correct', type: 'boolean', required: true },
          { name: 'comments', label: 'Approval Comments', type: 'textarea', required: false },
          { name: 'attachments', label: 'Attachments (final signed report)', type: 'file', required: false, multiple: true }
        ]
      },
      {
        stepNumber: 8,
        stepName: 'Device Return to Customer',
        stepDescription: 'Ship repaired device back to customer',
        isOptional: false,
        fields: [
          { name: 'shipmentDate', label: 'Shipment Date', type: 'date', required: true },
          { name: 'shipmentAgentId', label: 'Responsible Agent', type: 'select', required: true, options: 'agents' },
          { name: 'returnTrackingNumber', label: 'Return Tracking Number', type: 'text', required: true },
          { name: 'shipmentComments', label: 'Shipment Comments', type: 'textarea', required: false },
          { name: 'comments', label: 'General Comments', type: 'textarea', required: false },
          { name: 'attachments', label: 'Attachments (shipment label)', type: 'file', required: false, multiple: true }
        ]
      },
      {
        stepNumber: 9,
        stepName: 'Post-Service',
        stepDescription: 'Confirm customer received and tested device',
        isOptional: false,
        fields: [
          { name: 'confirmationDate', label: 'Confirmation Date', type: 'date', required: true },
          { name: 'confirmationAgentId', label: 'Responsible Agent', type: 'select', required: true, options: 'agents' },
          { name: 'contactPerson', label: 'Customer Contact Name', type: 'text', required: true },
          { name: 'confirmationStatus', label: 'Confirmation Status', type: 'boolean', required: true, 
            labels: { true: 'Confirmed - Device Working', false: 'Issue Reported' }
          },
          { name: 'confirmationNotes', label: 'Confirmation Notes', type: 'textarea', required: false },
          { name: 'comments', label: 'General Comments', type: 'textarea', required: false }
        ]
      },
      {
        stepNumber: 10,
        stepName: 'Loaner Return to Company',
        stepDescription: 'Return of loaner device (only if loaner was sent)',
        isOptional: true,
        dependsOnStep: 2,
        dependsOnField: 'sendLoaner',
        fields: [
          { name: 'returnDate', label: 'Return Date', type: 'date', required: 'conditional' },
          { name: 'loanerReturnTrackingNumber', label: 'Loaner Return Tracking Number', type: 'text', required: 'conditional' },
          { name: 'receivingAgentId', label: 'Receiving Agent', type: 'select', required: 'conditional', options: 'agents' },
          { name: 'comments', label: 'Comments', type: 'textarea', required: false }
        ]
      }
    ];
  }

  // Create a new service workflow
  async createWorkflow(ticketId, deviceSerialNumber, initiatedBy) {
    const workflowId = uuidv4();
    
    // Find device by serial number
    const device = null; // TODO: Implement device lookup from database
    
    const workflow = {
      workflowId,
      ticketId,
      deviceId: device?.deviceId || null,
      deviceSerialNumber,
      workflowNumber: this.generateWorkflowNumber(),
      currentStep: 1,
      status: 'in_progress',
      initiatedBy,
      initiatedAt: new Date().toISOString(),
      completedAt: null,
      cancelledAt: null,
      cancelledBy: null,
      cancellationReason: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.workflows.push(workflow);

    // Create all workflow steps
    this.stepDefinitions.forEach(stepDef => {
      const step = {
        stepId: uuidv4(),
        workflowId,
        stepNumber: stepDef.stepNumber,
        stepName: stepDef.stepName,
        stepDescription: stepDef.stepDescription,
        isOptional: stepDef.isOptional,
        status: stepDef.stepNumber === 1 ? 'in_progress' : 'not_started',
        startedAt: stepDef.stepNumber === 1 ? new Date().toISOString() : null,
        completedAt: null,
        agentId: stepDef.stepNumber === 1 ? initiatedBy : null,
        agentName: null,
        
        // Initialize all step-specific fields as null
        // Step 1 fields
        deviceSerialNumber: stepDef.stepNumber === 1 ? deviceSerialNumber : null,
        defectDescription: null,
        customerTrackingNumber: null,
        assignedAgentId: stepDef.stepNumber === 1 ? initiatedBy : null,
        requestedDate: stepDef.stepNumber === 1 ? new Date().toISOString() : null,
        
        // Step 2 fields
        sendLoaner: false,
        loanerModel: null,
        loanerSerialNumber: null,
        loanerTrackingNumber: null,
        shipmentDate: null,
        loanerAgentId: null,
        
        // Step 3 fields
        receivedDate: null,
        cleaningDate: null,
        productIdConfirmationDate: null,
        inspectionAgentId: null, // Step 3 responsible agent
        receivedParts: null, // JSON array
        inspectionComments: null,
        
        // Step 4 fields
        analysisDate: null,
        analysisAgentId: null, // Step 4 responsible agent
        findingsDescription: null,
        replacementParts: null, // JSON array
        diagnosticSummary: null,
        
        // Step 5 fields
        quoteNumber: null,
        quoteDate: null,
        quoteAgentId: null, // Step 5 responsible agent
        approvalStatus: 'pending',
        approvalDate: null,
        invoiceNumber: null,
        
        // Step 6 fields
        correctionDate: null,
        repairAgentId: null, // Step 6 responsible agent
        repairDescription: null,
        partsUsed: null, // JSON array
        testChecklist: null, // JSON object
        finalRepairApproval: false,
        
        // Step 7 fields
        approverAgentId: null,
        approvalDeclaration: false,
        
        // Step 8 fields
        returnTrackingNumber: null,
        shipmentAgentId: null, // Step 8 responsible agent
        shipmentComments: null,
        
        // Step 9 fields
        confirmationDate: null,
        confirmationAgentId: null, // Step 9 responsible agent
        contactPerson: null,
        confirmationStatus: false,
        confirmationNotes: null,
        
        // Step 10 fields
        returnDate: null,
        loanerReturnTrackingNumber: null,
        receivingAgentId: null,
        
        // Common fields
        completionDate: null,
        comments: null,
        stepUpdatedAt: new Date().toISOString(),
        updatedBy: null,
        
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      this.workflowSteps.push(step);
    });

    this.logAudit(workflowId, null, 'workflow_created', 
      `Service workflow created for device ${deviceSerialNumber}`, initiatedBy);

    return workflow;
  }

  // Get workflow with all steps and their current data
  async getWorkflow(workflowId) {
    const workflow = this.workflows.find(w => w.workflowId === workflowId);
    if (!workflow) return null;

    const steps = this.workflowSteps.filter(s => s.workflowId === workflowId)
      .sort((a, b) => a.stepNumber - b.stepNumber);

    return {
      ...workflow,
      steps: steps.map(step => ({
        ...step,
        definition: this.getStepDefinition(step.stepNumber)
      }))
    };
  }

  // Get workflows by ticket
  async getWorkflowsByTicket(ticketId) {
    return this.workflows.filter(w => w.ticketId === ticketId);
  }

  // Get workflows by device serial number
  async getWorkflowsByDevice(deviceSerialNumber) {
    return this.workflows.filter(w => w.deviceSerialNumber === deviceSerialNumber);
  }

  // Get all workflows
  async getAllWorkflows() {
    return this.workflows;
  }

  // Update workflow step with comprehensive data
  async updateWorkflowStep(stepId, stepData, agentId) {
    const step = this.workflowSteps.find(s => s.stepId === stepId);
    if (!step) {
      throw new Error('Workflow step not found');
    }

    const workflow = this.workflows.find(w => w.workflowId === step.workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // Validate step data based on step definition
    const stepDefinition = this.getStepDefinition(step.stepNumber);
    const validation = this.validateStepData(stepDefinition, stepData, step.workflowId);
    
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Update step with provided data
    Object.keys(stepData).forEach(key => {
      if (stepData[key] !== undefined) {
        step[key] = stepData[key];
      }
    });

    // Update common fields
    step.agentId = agentId;
    step.updatedBy = agentId;
    step.stepUpdatedAt = new Date().toISOString();
    step.updatedAt = new Date().toISOString();

    // If step is being completed
    if (stepData.status === 'completed') {
      step.completedAt = new Date().toISOString();
      step.completionDate = new Date().toISOString();
      
      // Advance workflow if this is the current step
      if (workflow.currentStep === step.stepNumber) {
        await this.advanceWorkflow(workflow.workflowId, step.stepNumber);
      }
    } else if (stepData.status === 'in_progress' && !step.startedAt) {
      step.startedAt = new Date().toISOString();
    }

    this.logAudit(step.workflowId, stepId, 'step_updated', 
      `Step ${step.stepNumber} (${step.stepName}) updated`, agentId);

    return step;
  }

  // Validate step data against definition
  validateStepData(stepDefinition, stepData, workflowId) {
    const errors = [];
    
    stepDefinition.fields.forEach(field => {
      const value = stepData[field.name];
      
      // Check required fields
      if (field.required === true && (value === null || value === undefined || value === '')) {
        errors.push(`${field.label} is required`);
      }
      
      // Check conditional requirements
      if (field.required === 'conditional' && field.dependsOn) {
        const dependentValue = stepData[field.dependsOn];
        if (field.dependsOnValue) {
          if (dependentValue === field.dependsOnValue && (value === null || value === undefined || value === '')) {
            errors.push(`${field.label} is required when ${field.dependsOn} is ${field.dependsOnValue}`);
          }
        } else if (dependentValue && (value === null || value === undefined || value === '')) {
          errors.push(`${field.label} is required when ${field.dependsOn} is set`);
        }
      }
      
      // Validate step 7 - different agent requirement
      if (field.validation === 'different_from_step6' && value) {
        const step6 = this.workflowSteps.find(s => s.workflowId === workflowId && s.stepNumber === 6);
        if (step6 && step6.agentId === value) {
          errors.push('Step 7 approver must be different from Step 6 agent');
        }
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Advance workflow to next step
  async advanceWorkflow(workflowId, completedStepNumber) {
    const workflow = this.workflows.find(w => w.workflowId === workflowId);
    if (!workflow) return;

    // Find next non-optional step or first optional step that should be processed
    let nextStep = completedStepNumber + 1;
    
    // Special logic for step 2 (loaner) - always go to step 2 after step 1
    // The user will decide in step 2 whether to send a loaner or not
    // Skipping logic is handled when step 2 is completed, not when step 1 is completed
    
    // Special logic when step 2 (loaner) is completed - check if step 10 should be skipped
    if (completedStepNumber === 2) {
      const step2 = this.workflowSteps.find(s => s.workflowId === workflowId && s.stepNumber === 2);
      const step10 = this.workflowSteps.find(s => s.workflowId === workflowId && s.stepNumber === 10);
      
      // If user chose not to send loaner, skip step 10 proactively
      if (!step2.sendLoaner) {
        step10.status = 'skipped';
        step10.completedAt = new Date().toISOString();
        this.logAudit(workflowId, step10.stepId, 'step_skipped', 
          'Step 10 (Loaner Return) skipped - no loaner was sent', workflow.initiatedBy);
      }
    }
    
    // Special logic for step 10 (loaner return) - only if loaner was sent
    if (completedStepNumber === 9) {
      const step2 = this.workflowSteps.find(s => s.workflowId === workflowId && s.stepNumber === 2);
      const step10 = this.workflowSteps.find(s => s.workflowId === workflowId && s.stepNumber === 10);
      
      if (!step2.sendLoaner || step2.status === 'skipped') {
        step10.status = 'skipped';
        step10.completedAt = new Date().toISOString();
        // Workflow is complete
        workflow.status = 'completed';
        workflow.completedAt = new Date().toISOString();
        
        this.logAudit(workflowId, null, 'workflow_completed', 
          'Service workflow completed successfully', workflow.initiatedBy);
        return;
      }
    }

    if (nextStep <= 10) {
      workflow.currentStep = nextStep;
      
      // Start the next step
      const nextStepObj = this.workflowSteps.find(s => s.workflowId === workflowId && s.stepNumber === nextStep);
      if (nextStepObj && nextStepObj.status === 'not_started') {
        nextStepObj.status = 'in_progress';
        nextStepObj.startedAt = new Date().toISOString();
      }
    } else {
      // Workflow completed
      workflow.status = 'completed';
      workflow.completedAt = new Date().toISOString();
      
      this.logAudit(workflowId, null, 'workflow_completed', 
        'Service workflow completed successfully', workflow.initiatedBy);
    }

    workflow.updatedAt = new Date().toISOString();
  }

  // Upload attachment
  async uploadAttachment(stepId, file, uploadedBy) {
    const step = this.workflowSteps.find(s => s.stepId === stepId);
    if (!step) {
      throw new Error('Step not found');
    }

    const attachmentId = uuidv4();
    const fileName = `${Date.now()}-${uuidv4()}.${file.originalname.split('.').pop()}`;
    
    // Create workflows directory if it doesn't exist
    const workflowsDir = path.join(__dirname, '../uploads', 'workflows');
    if (!fs.existsSync(workflowsDir)) {
      fs.mkdirSync(workflowsDir, { recursive: true });
    }
    
    const absoluteFilePath = path.join(workflowsDir, fileName);
    const relativeFilePath = path.join('uploads', 'workflows', fileName);
    
    // Move file from multer temp location to workflow directory
    try {
      if (file.path) {
        // File was already saved by multer, move it to workflow directory
        fs.renameSync(file.path, absoluteFilePath);
      } else {
        // File buffer needs to be written (shouldn't happen with diskStorage)
        fs.writeFileSync(absoluteFilePath, file.buffer);
      }
    } catch (error) {
      console.error('Error moving file:', error);
      throw new Error('Failed to save file');
    }

    const attachment = {
      attachmentId,
      stepId,
      workflowId: step.workflowId,
      fileName,
      originalName: file.originalname,
      filePath: relativeFilePath, // Store relative path for backend download endpoint
      fileSize: file.size,
      fileType: file.mimetype,
      mimeType: file.mimetype,
      uploadedBy,
      uploadedAt: new Date().toISOString()
    };

    this.workflowAttachments.push(attachment);

    this.logAudit(step.workflowId, stepId, 'attachment_uploaded', 
      `File uploaded: ${file.originalname}`, uploadedBy);

    return attachment;
  }

  getStepDefinition(stepNumber) {
    return this.stepDefinitions.find(def => def.stepNumber === stepNumber);
  }

  getAllStepDefinitions() {
    return this.stepDefinitions;
  }

  generateWorkflowNumber() {
    return `SWF-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;
  }

  logAudit(workflowId, stepId, action, description, performedBy) {
    const auditEntry = {
      auditId: uuidv4(),
      workflowId,
      stepId,
      action,
      description,
      performedBy,
      performedAt: new Date().toISOString(),
      contextData: JSON.stringify({
        timestamp: new Date().toISOString(),
        action,
        stepId,
        workflowId
      })
    };

    this.auditLogs.push(auditEntry);
  }

  async getWorkflowAuditLogs(workflowId) {
    return this.auditLogs.filter(log => log.workflowId === workflowId)
      .sort((a, b) => new Date(b.performedAt) - new Date(a.performedAt));
  }

  // Get step attachment
  async getStepAttachments(stepId) {
    return this.workflowAttachments.filter(att => att.stepId === stepId);
  }

  // Get single attachment by ID
  async getAttachment(attachmentId) {
    const attachment = this.workflowAttachments.find(att => att.attachmentId === attachmentId);
    if (!attachment) {
      throw new Error('Attachment not found');
    }
    return attachment;
  }

  // Delete attachment
  async deleteAttachment(attachmentId) {
    const attachmentIndex = this.workflowAttachments.findIndex(att => att.attachmentId === attachmentId);
    if (attachmentIndex === -1) {
      throw new Error('Attachment not found');
    }

    const attachment = this.workflowAttachments[attachmentIndex];
    
    // Delete physical file
    try {
      const fullPath = path.join(__dirname, '../', attachment.filePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log(`🗑️ Deleted file: ${fullPath}`);
      }
    } catch (error) {
      console.error('Error deleting physical file:', error);
      // Continue with database deletion even if file deletion fails
    }
    
    // Remove from array
    this.workflowAttachments.splice(attachmentIndex, 1);

    // Log deletion
    this.logAudit(attachment.workflowId, attachment.stepId, 'attachment_deleted', 
      `File deleted: ${attachment.originalName}`, null);

    return attachment;
  }

  // Check if step can be skipped
  canSkipStep(stepNumber, workflowId) {
    const stepDef = this.getStepDefinition(stepNumber);
    if (!stepDef.isOptional) return false;
    
    // Step 2 can be skipped if no loaner is being sent
    if (stepNumber === 2) {
      return true; // User can decide whether to send loaner
    }
    
    // Step 10 can be skipped if no loaner was sent in step 2
    if (stepNumber === 10) {
      const step2 = this.workflowSteps.find(s => s.workflowId === workflowId && s.stepNumber === 2);
      return !step2.sendLoaner || step2.status === 'skipped';
    }
    
    return false;
  }
}

module.exports = new ServiceWorkflowService(); 