const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class PdfReportService {
  constructor() {
    this.reportsDir = path.join(__dirname, '../reports');
    this.ensureReportsDirectory();
  }

  ensureReportsDirectory() {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  async generateServiceWorkflowReport(workflow, ticket, reportType = 'draft', users = [], companies = []) {
    try {
      const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();

      // Generate HTML content for the report
      const htmlContent = this.generateReportHTML(workflow, ticket, reportType, users, companies);
      
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `service-report-${workflow.workflowNumber}-${reportType}-${timestamp}.pdf`;
      const filepath = path.join(this.reportsDir, filename);

      // Generate PDF
      await page.pdf({
        path: filepath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        }
      });

      await browser.close();

      // Store report metadata
      const reportMetadata = {
        filename,
        filepath,
        workflowId: workflow.workflowId,
        reportType,
        createdAt: new Date().toISOString(),
        workflowNumber: workflow.workflowNumber
      };

      return reportMetadata;

    } catch (error) {
      console.error('Error generating PDF report:', error);
      throw error;
    }
  }

  generateReportHTML(workflow, ticket, reportType, users = [], companies = []) {
    // Store users array for agent name lookup
    this.users = users;
    
    const stepData = this.extractStepData(workflow);
    
    // Get company name from ticket - comprehensive mapping from ticket details
    console.log('🏢 DEBUG: Ticket company info:', {
      customerCompany: ticket?.customerCompany,
      companyId: ticket?.companyId,
      ticketId: ticket?.id,
      ticketNumber: ticket?.ticketNumber,
      ticketObject: ticket
    });
    
    console.log('🏢 DEBUG: Companies array passed:', companies ? companies.length : 'null', companies);
    
    let companyName = ticket?.customerCompany || ticket?.customer_company || ticket?.companyName || ticket?.company?.name;
    console.log('🏢 DEBUG: Direct company name from fields:', companyName);
    
    // If no direct company name found, try to resolve from companyId
    if (!companyName && ticket?.companyId && companies && companies.length > 0) {
      console.log('🏢 Looking for companyId:', ticket.companyId, 'in companies:', companies.map(c => `${c.name} (${c.id})`));
      const company = companies.find(c => c.id === ticket.companyId);
      if (company) {
        companyName = company.name;
        console.log('🏢 ✅ Resolved company name from companyId:', ticket.companyId, '->', companyName);
      } else {
        console.log('🏢 ❌ Company not found for companyId:', ticket.companyId);
      }
    } else {
      console.log('🏢 Skipping companyId resolution:', {
        hasCompanyName: !!companyName,
        hasCompanyId: !!ticket?.companyId,
        hasCompanies: !!(companies && companies.length > 0),
        companiesLength: companies?.length
      });
    }
    
    // Also try to match by customer company name if we have companies array
    if (!companyName && ticket?.customerCompany && companies && companies.length > 0) {
      console.log('🏢 Trying to match customerCompany:', ticket.customerCompany, 'against company names');
      const company = companies.find(c => 
        c.name === ticket.customerCompany ||
        (c.aliases && c.aliases.includes(ticket.customerCompany))
      );
      if (company) {
        companyName = company.name;
        console.log('🏢 ✅ Matched customerCompany to existing company:', ticket.customerCompany, '->', companyName);
      } else {
        console.log('🏢 ❌ No company match found for customerCompany:', ticket.customerCompany);
      }
    }
    
    // Final fallback - if we still don't have a company name, use customerCompany or any company field
    if (!companyName) {
      companyName = ticket?.customerCompany || ticket?.customer_company || ticket?.companyName || 'N/A';
      console.log('🏢 Using fallback company name:', companyName);
    }
    console.log('🏢 🎯 FINAL company name for report:', companyName);
    
    // Extract specific data from steps with improved field mapping
    const step1Data = stepData[1] || {};
    const step2Data = stepData[2] || {};
    const step3Data = stepData[3] || {};
    const step4Data = stepData[4] || {};
    const step5Data = stepData[5] || {};
    const step6Data = stepData[6] || {};
    const step7Data = stepData[7] || {};
    
    // Get quote and invoice numbers from step 5 data
    const quoteNumber = step5Data.quoteNumber || step5Data.quote_number || 'N/A';
    const invoiceNumber = step5Data.invoiceNumber || step5Data.invoice_number || 'N/A';
    
    // Get defect description from step 1 or ticket
    const defectDescription = step1Data.defectDescription || step1Data.defect_description || ticket?.description || 'N/A';
    
    // Get agent names for signatures - improved mapping
    const serviceResponsible = this.getAgentName(step6Data.repairAgentId || step6Data.repair_agent_id) || 'N/A';
    const reportApproval = this.getAgentName(step7Data.approverAgentId || step7Data.approver_agent_id) || 'N/A';
    
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Service Report</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.4;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          font-size: 12px;
        }
        
        @page {
          margin: 1in;
          @bottom-center {
            content: "Page " counter(page) " of " counter(pages);
            font-size: 10px;
            color: #666;
          }
        }
        
        .header {
          text-align: center;
          border-bottom: 3px solid #2563eb;
          padding-bottom: 20px;
          margin-bottom: 30px;
          position: relative;
        }
        
        .logo {
          width: 300px;
          height: auto;
          margin-bottom: 15px;
          max-width: 100%;
        }
        
        .header h1 {
          color: #1e40af;
          font-size: 24px;
          margin: 0 0 10px 0;
        }
        
        .header .subtitle {
          color: #64748b;
          font-size: 14px;
        }
        
        .service-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 30px;
          background: #f8fafc;
          padding: 20px;
          border-radius: 8px;
        }
        
        .info-section h3 {
          color: #1e40af;
          font-size: 14px;
          margin: 0 0 10px 0;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 5px;
        }
        
        .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
        }
        
        .label {
          font-weight: 600;
          color: #475569;
        }
        
        .value {
          color: #1e293b;
        }
        
        .service-content {
          margin-top: 30px;
        }
        
        .service-section {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          margin-bottom: 20px;
          overflow: hidden;
          background: #ffffff;
        }
        
        .service-section-header {
          background: #1e40af;
          color: white;
          padding: 12px 20px;
          font-weight: 600;
          font-size: 15px;
        }
        
        .service-section-content {
          padding: 20px;
        }
        
        .field-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin-bottom: 15px;
        }
        
        .field-single {
          display: grid;
          grid-template-columns: 1fr;
          gap: 15px;
          margin-bottom: 15px;
        }
        
        .field {
          display: flex;
          flex-direction: column;
        }
        
        .field-label {
          font-weight: 600;
          color: #374151;
          font-size: 11px;
          margin-bottom: 4px;
        }
        
        .field-value {
          color: #1f2937;
          font-size: 12px;
          background: #f9fafb;
          padding: 8px 12px;
          border-radius: 4px;
          border: 1px solid #e5e7eb;
          min-height: 20px;
        }
        
        .parts-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
          font-size: 11px;
        }
        
        .parts-table th,
        .parts-table td {
          border: 1px solid #e5e7eb;
          padding: 8px;
          text-align: left;
        }
        
        .parts-table th {
          background: #f3f4f6;
          font-weight: 600;
        }
        
        .checklist {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        
        .checklist-item {
          display: flex;
          align-items: center;
          padding: 4px 0;
          font-size: 12px;
        }
        
        .checklist-checkbox {
          width: 16px;
          height: 16px;
          border: 2px solid #d1d5db;
          border-radius: 3px;
          margin-right: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: white;
        }
        
        .checklist-checkbox.checked {
          background: #10b981;
          border-color: #10b981;
          color: white;
        }
        
        .signatures {
          margin-top: 40px;
          padding: 20px;
          border-top: 2px solid #e2e8f0;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
        }
        
        .signature-field {
          text-align: center;
        }
        
        .signature-name {
          font-weight: 600;
          color: #1e40af;
          margin-bottom: 20px;
          font-size: 14px;
        }
        
        .signature-line {
          border-bottom: 2px solid #374151;
          height: 40px;
          margin-bottom: 8px;
        }
        
        .signature-label {
          color: #6b7280;
          font-size: 12px;
        }
        
        .footer {
          margin-top: 30px;
          text-align: center;
          color: #64748b;
          font-size: 10px;
          border-top: 1px solid #e2e8f0;
          padding-top: 20px;
        }
        
        @media print {
          body { margin: 0; }
          .service-section { break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <svg width="400" height="100" viewBox="0 0 400 100" xmlns="http://www.w3.org/2000/svg" class="logo">
          <!-- Orange/Yellow wave elements -->
          <path d="M20 30 Q30 10, 40 30 Q50 50, 60 30 Q70 10, 80 30 Q90 50, 100 30" 
                stroke="#FF8C00" stroke-width="8" fill="none" stroke-linecap="round"/>
          <path d="M25 35 Q35 55, 45 35 Q55 15, 65 35 Q75 55, 85 35" 
                stroke="#FFA500" stroke-width="6" fill="none" stroke-linecap="round"/>
          <path d="M30 25 Q40 45, 50 25 Q60 5, 70 25" 
                stroke="#FFD700" stroke-width="4" fill="none" stroke-linecap="round"/>
          
          <!-- NeuroVirtual text -->
          <text x="130" y="45" fill="#1e3a8a" font-size="28" font-weight="bold" font-family="Arial, sans-serif">
            NEUROVIRTUAL
          </text>
          
          <!-- Orange dot in the 'O' -->
          <circle cx="290" cy="35" r="6" fill="#FF8C00"/>
        </svg>
        <h1>Service Report</h1>
        <div class="subtitle">
          Generated on ${new Date().toLocaleDateString()}
        </div>
      </div>

      <div class="service-info">
        <div class="info-section">
          <h3>Report Information</h3>
          <div class="info-row">
            <span class="label">Company:</span>
            <span class="value">${companyName}</span>
          </div>
          <div class="info-row">
            <span class="label">Contact:</span>
            <span class="value">${ticket?.customer_name || ticket?.customerName || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="label">Quote Number:</span>
            <span class="value">${quoteNumber}</span>
          </div>
          <div class="info-row">
            <span class="label">Invoice Number:</span>
            <span class="value">${invoiceNumber}</span>
          </div>
        </div>
        
        <div class="info-section">
          <h3>Service Details</h3>
          <div class="info-row">
            <span class="label">Service Number:</span>
            <span class="value">${workflow.workflowNumber}</span>
          </div>
          <div class="info-row">
            <span class="label">Device Serial:</span>
            <span class="value">${workflow.deviceSerialNumber}</span>
          </div>
          <div class="info-row">
            <span class="label">Ticket Number:</span>
            <span class="value">${ticket?.ticket_number || ticket?.ticketNumber || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="label">Started:</span>
            <span class="value">${new Date(workflow.initiatedAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <div class="service-content">
        <h2 style="color: #1e40af; margin-bottom: 20px;">Service Information</h2>
        
        <div class="service-section">
          <div class="service-section-header">Initial Assessment</div>
          <div class="service-section-content">
            <div class="field-grid">
              <div class="field">
                <div class="field-label">Service Serial Number</div>
                <div class="field-value">${step1Data.deviceSerialNumber || step1Data.device_serial_number || workflow.deviceSerialNumber || 'N/A'}</div>
              </div>
              <div class="field">
                <div class="field-label">Defect Description</div>
                <div class="field-value">${defectDescription}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="service-section">
          <div class="service-section-header">Loaner Assignment</div>
          <div class="service-section-content">
            <div class="field-grid">
              <div class="field">
                <div class="field-label">Loaner Serial Number</div>
                <div class="field-value">${step2Data.loanerSerialNumber || step2Data.loaner_serial_number || 'N/A'}</div>
              </div>
              <div class="field">
                <div class="field-label">Loaner Model</div>
                <div class="field-value">${step2Data.loanerModel || step2Data.loaner_model || 'N/A'}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="service-section">
          <div class="service-section-header">Receiving & Cleaning</div>
          <div class="service-section-content">
            <div class="field-grid">
              <div class="field">
                <div class="field-label">Date Received</div>
                <div class="field-value">${step3Data.receivedDate ? new Date(step3Data.receivedDate).toLocaleDateString() : step3Data.received_date ? new Date(step3Data.received_date).toLocaleDateString() : 'N/A'}</div>
              </div>
              <div class="field">
                <div class="field-label">Cleaning Date</div>
                <div class="field-value">${step3Data.cleaningDate ? new Date(step3Data.cleaningDate).toLocaleDateString() : step3Data.cleaning_date ? new Date(step3Data.cleaning_date).toLocaleDateString() : 'N/A'}</div>
              </div>
              <div class="field">
                <div class="field-label">Product ID Date</div>
                <div class="field-value">${step3Data.productIdConfirmationDate ? new Date(step3Data.productIdConfirmationDate).toLocaleDateString() : step3Data.product_id_confirmation_date ? new Date(step3Data.product_id_confirmation_date).toLocaleDateString() : 'N/A'}</div>
              </div>
              <div class="field">
                <div class="field-label">Inspection Comments</div>
                <div class="field-value">${step3Data.inspectionComments || step3Data.inspection_comments || 'N/A'}</div>
              </div>
            </div>
            ${(step3Data.receivedParts || step3Data.received_parts) ? `
            <div class="field-single">
              <div class="field">
                <div class="field-label">Received Parts</div>
                <div class="field-value">
                  ${this.formatPartsTable(step3Data.receivedParts || step3Data.received_parts)}
                </div>
              </div>
            </div>
            ` : ''}
          </div>
        </div>

        <div class="service-section">
          <div class="service-section-header">Analysis & Diagnosis</div>
          <div class="service-section-content">
            <div class="field-grid">
              <div class="field">
                <div class="field-label">Analysis Date</div>
                <div class="field-value">${step4Data.analysisDate ? new Date(step4Data.analysisDate).toLocaleDateString() : step4Data.analysis_date ? new Date(step4Data.analysis_date).toLocaleDateString() : 'N/A'}</div>
              </div>
            </div>

            <div class="field-single">
              <div class="field">
                <div class="field-label">Diagnostic Summary</div>
                <div class="field-value">${step4Data.diagnosticSummary || step4Data.diagnostic_summary || 'N/A'}</div>
              </div>
            </div>
            ${(step4Data.replacementParts || step4Data.replacement_parts) ? `
            <div class="field-single">
              <div class="field">
                <div class="field-label">Replacement Parts</div>
                <div class="field-value">
                  ${this.formatPartsTable(step4Data.replacementParts || step4Data.replacement_parts)}
                </div>
              </div>
            </div>
            ` : ''}
          </div>
        </div>

        <div class="service-section">
          <div class="service-section-header">Repair & Testing</div>
          <div class="service-section-content">


            ${(step6Data.partsUsed || step6Data.parts_used) ? `
            <div class="field-single">
              <div class="field">
                <div class="field-label">Parts Used in Repair</div>
                <div class="field-value">
                  ${this.formatPartsTable(step6Data.partsUsed || step6Data.parts_used)}
                </div>
              </div>
            </div>
            ` : ''}
            ${(step6Data.testChecklist || step6Data.test_checklist) ? `
            <div class="field-single">
              <div class="field">
                <div class="field-label">Test Checklist</div>
                <div class="field-value">
                  ${this.formatChecklist(step6Data.testChecklist || step6Data.test_checklist)}
                </div>
              </div>
            </div>
            ` : ''}
            <div class="field-single">
              <div class="field">
                <div class="field-label">Repair Approval Responsible Agent</div>
                <div class="field-value">${serviceResponsible}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="signatures">
        <div class="signature-field">
          <div class="signature-name">${serviceResponsible}</div>
          <div class="signature-line"></div>
          <div class="signature-label">Service Responsible</div>
        </div>
        <div class="signature-field">
          <div class="signature-name">${reportApproval}</div>
          <div class="signature-line"></div>
          <div class="signature-label">Report Approval</div>
        </div>
      </div>

      <div class="footer">
        <p>This report was automatically generated by NeuroChat Service Management System</p>
        <p>Generated: ${new Date().toLocaleString()}</p>
      </div>
    </body>
    </html>
    `;
  }

  generateStepFields(step, stepData) {
    if (!step.definition?.fields) return '<p>No fields defined for this step</p>';

    return `
      <div class="field-grid">
        ${step.definition.fields.map(field => {
          const value = stepData[field.name] || step[field.name] || '';
          const displayValue = this.formatFieldValue(field, value);
          
          return `
            <div class="field">
              <div class="field-label">${field.label}</div>
              <div class="field-value">${displayValue}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  formatFieldValue(field, value) {
    if (!value) return '-';
    
    switch (field.type) {
      case 'date':
        return new Date(value).toLocaleDateString();
      case 'boolean':
        return value ? 'Yes' : 'No';
      case 'parts_table':
      case 'checklist':
        return typeof value === 'object' ? JSON.stringify(value, null, 2) : value;
      default:
        return String(value);
    }
  }

  formatPartsTable(partsData) {
    if (!partsData) return 'No parts data available';
    
    // If it's a string, try to parse it as JSON
    let parts;
    if (typeof partsData === 'string') {
      try {
        parts = JSON.parse(partsData);
      } catch (e) {
        return partsData; // Return as-is if not valid JSON
      }
    } else {
      parts = partsData;
    }
    
    // If it's an array of parts
    if (Array.isArray(parts)) {
      if (parts.length === 0) return 'No parts';
      
      return `
        <table class="parts-table">
          <thead>
            <tr>
              <th>Part Number</th>
              <th>Description</th>
              <th>Quantity</th>
              <th>Serial Number</th>
            </tr>
          </thead>
          <tbody>
            ${parts.map(part => `
              <tr>
                <td>${part.partNumber || part.part_number || part.partModel || '-'}</td>
                <td>${part.description || part.name || part.partName || '-'}</td>
                <td>${part.quantity || '1'}</td>
                <td>${part.serialNumber || part.serial_number || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
    
    // If it's an object with parts information
    if (typeof parts === 'object') {
      return `
        <table class="parts-table">
          <thead>
            <tr>
              <th>Field</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(parts).map(([key, value]) => `
              <tr>
                <td>${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</td>
                <td>${value || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
    
    return String(parts);
  }

  formatChecklist(checklistData) {
    if (!checklistData) return 'No checklist data available';
    
    // If it's a string, try to parse it as JSON
    let checklist;
    if (typeof checklistData === 'string') {
      try {
        checklist = JSON.parse(checklistData);
      } catch (e) {
        return checklistData; // Return as-is if not valid JSON
      }
    } else {
      checklist = checklistData;
    }
    
    // If it's an array of checklist items
    if (Array.isArray(checklist)) {
      if (checklist.length === 0) return 'No checklist items';
      
      return `
        <ul class="checklist">
          ${checklist.map(item => {
            const isChecked = item.checked || item.completed || false;
            const label = item.label || item.description || item.name || String(item);
            
            return `
              <li class="checklist-item">
                <div class="checklist-checkbox ${isChecked ? 'checked' : ''}">
                  ${isChecked ? '✓' : ''}
                </div>
                <span>${label}</span>
              </li>
            `;
          }).join('')}
        </ul>
      `;
    }
    
    // If it's an object with checklist information
    if (typeof checklist === 'object') {
      return `
        <ul class="checklist">
          ${Object.entries(checklist).map(([key, value]) => {
            const isChecked = value === true || value === 'completed' || value === 'checked';
            const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            
            return `
              <li class="checklist-item">
                <div class="checklist-checkbox ${isChecked ? 'checked' : ''}">
                  ${isChecked ? '✓' : ''}
                </div>
                <span>${label}: ${typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}</span>
              </li>
            `;
          }).join('')}
        </ul>
      `;
    }
    
    return String(checklist);
  }

  generateStep3PartsDescription(step3Data) {
    if (!step3Data) return 'N/A';
    
    const receivedParts = step3Data.receivedParts || step3Data.received_parts;
    if (!receivedParts) return 'N/A';
    
    // If it's a string, try to parse it as JSON
    let parts;
    if (typeof receivedParts === 'string') {
      try {
        parts = JSON.parse(receivedParts);
      } catch (e) {
        return 'Invalid parts data';
      }
    } else {
      parts = receivedParts;
    }
    
    // If it's an array of parts
    if (Array.isArray(parts) && parts.length > 0) {
      const descriptions = parts.map(part => {
        const partName = part.partName || part.part_name || part.name || 'Unknown Part';
        const serialNumber = part.serialNumber || part.serial_number || 'No Serial';
        return `${partName} (Serial: ${serialNumber})`;
      });
      return descriptions.join(', ');
    }
    
    return 'No parts received';
  }

  generateStep4PartsDescription(step4Data) {
    if (!step4Data) return 'N/A';
    
    const replacementParts = step4Data.replacementParts || step4Data.replacement_parts;
    if (!replacementParts) return 'N/A';
    
    // If it's a string, try to parse it as JSON
    let parts;
    if (typeof replacementParts === 'string') {
      try {
        parts = JSON.parse(replacementParts);
      } catch (e) {
        return 'Invalid parts data';
      }
    } else {
      parts = replacementParts;
    }
    
    // If it's an array of parts
    if (Array.isArray(parts) && parts.length > 0) {
      const descriptions = parts.map(part => {
        const partName = part.partName || part.part_name || part.name || 'Unknown Part';
        const partNumber = part.partNumber || part.part_number || 'No Part Number';
        return `${partName} (Part #: ${partNumber})`;
      });
      return descriptions.join(', ');
    }
    
    return 'No replacement parts identified';
  }

  extractStepData(workflow) {
    const stepData = {};
    
    // Ensure workflow.steps exists
    if (!workflow.steps || !Array.isArray(workflow.steps)) {
      console.warn('Workflow has no steps array:', workflow);
      return stepData;
    }
    
    workflow.steps.forEach(step => {
      stepData[step.stepNumber] = {};
      
      // Extract all available data from the step, not just definition fields
      Object.keys(step).forEach(key => {
        if (key !== 'definition' && step[key] !== null && step[key] !== undefined) {
          stepData[step.stepNumber][key] = step[key];
        }
      });
      
      // Also check definition fields if they exist
      if (step.definition?.fields) {
        step.definition.fields.forEach(field => {
          if (step[field.name] !== null && step[field.name] !== undefined) {
            stepData[step.stepNumber][field.name] = step[field.name];
          }
        });
      }
    });
    
    return stepData;
  }

  // Helper method to get agent name by ID
  getAgentName(agentId) {
    if (!agentId) return null;
    
    // Look up the agent in the users array
    if (this.users && Array.isArray(this.users)) {
      const agent = this.users.find(u => u.id === agentId);
      if (agent) {
        return `${agent.firstName} ${agent.lastName}`;
      }
    }
    
    // Fallback to agent ID if not found
    return `Agent ${agentId}`;
  }

  // Get list of generated reports for a workflow
  getWorkflowReports(workflowNumber) {
    try {
      console.log('🔍 PDF Service: Looking for reports with workflow number:', workflowNumber);
      console.log('📁 PDF Service: Searching in directory:', this.reportsDir);
      console.log('📁 PDF Service: Directory exists?', fs.existsSync(this.reportsDir));
      console.log('📁 PDF Service: __dirname is:', __dirname);
      console.log('📁 PDF Service: Full resolved path:', path.resolve(this.reportsDir));
      
      if (!fs.existsSync(this.reportsDir)) {
        console.log('❌ PDF Service: Reports directory does not exist!');
        return [];
      }
      
      const files = fs.readdirSync(this.reportsDir);
      console.log('📁 PDF Service: All files in directory:', files);
      
      const reports = [];
      
      files.forEach(filename => {
        console.log('📄 PDF Service: Checking file:', filename, 'includes workflowNumber?', filename.includes(workflowNumber));
        
        if (filename.includes(workflowNumber) && filename.endsWith('.pdf')) {
          const filepath = path.join(this.reportsDir, filename);
          const stats = fs.statSync(filepath);
          
          const report = {
            filename,
            filepath,
            directory: this.reportsDir,
            reportType: filename.includes('-draft-') ? 'draft' : 'final',
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
            size: stats.size,
            formattedSize: this.formatFileSize(stats.size),
            relativePath: path.relative(process.cwd(), filepath)
          };
          
          reports.push(report);
          console.log('✅ PDF Service: Added report:', report.filename);
        }
      });
      
      console.log('📊 PDF Service: Total matching reports found:', reports.length);
      
      // If no reports found for this workflow number, also check for orphaned reports
      if (reports.length === 0) {
        console.log('🔍 PDF Service: No reports found for workflow number, checking for orphaned reports...');
        
        // Get all PDF files and show available workflow numbers
        const allPdfFiles = files.filter(f => f.endsWith('.pdf') && f.startsWith('service-report-'));
        const availableWorkflowNumbers = new Set();
        
        allPdfFiles.forEach(filename => {
          const match = filename.match(/service-report-(.+?)-draft-/);
          if (match) {
            availableWorkflowNumbers.add(match[1]);
          }
        });
        
        console.log('📋 PDF Service: Available workflow numbers in files:', Array.from(availableWorkflowNumbers));
        console.log('🔍 PDF Service: Requested workflow number:', workflowNumber);
        
        // If there are orphaned reports with known workflow numbers, suggest them
        if (availableWorkflowNumbers.size > 0) {
          console.log('💡 PDF Service: Consider using one of the available workflow numbers to see existing reports');
        }
      }
      
      return reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (error) {
      console.error('Error getting workflow reports:', error);
      return [];
    }
  }

  // Get report file path
  getReportPath(filename) {
    return path.join(this.reportsDir, filename);
  }

  // Format file size to human readable format
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Delete a report file
  deleteReport(filename) {
    try {
      const filepath = path.join(this.reportsDir, filename);
      
      if (!fs.existsSync(filepath)) {
        throw new Error('Report file not found');
      }

      fs.unlinkSync(filepath);
      
      return {
        success: true,
        message: `Report ${filename} deleted successfully`
      };
    } catch (error) {
      console.error('Error deleting report:', error);
      throw error;
    }
  }
}

module.exports = PdfReportService; 