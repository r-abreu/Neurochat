# Audit Trail Implementation

## Overview
This document describes the comprehensive audit trail system implemented in the NeuroChat application. The audit trail tracks user activities, system changes, and provides administrators with visibility into system usage and security events.

## Features Implemented

### 1. Database Schema
- **AuditLog table** added to `database/schema.sql`
- **audit.view permission** added to permissions system
- **Migration file** created for adding audit permission to existing systems

### 2. Backend Implementation
- **Audit logging system** with helper functions in `backend/server.js`
- **API endpoints** for retrieving audit logs and statistics
- **Automatic logging** integrated into existing endpoints

### 3. Frontend Components
- **AuditTrail component** with search and filtering capabilities
- **Role management** updated to include audit.view permission
- **User management** tab integration for audit trail access

## What Gets Logged

### Agent Activities
- ✅ Login attempts (success/failure)
- ✅ Ticket creation
- ✅ Ticket editing (with change details)
- ✅ Ticket deletion
- ✅ Ticket claiming
- ✅ Message sending to customers
- ✅ Internal comment addition
- ✅ Audit trail access

### Customer Activities
- ✅ Ticket creation (authenticated and anonymous)
- ✅ Message sending in tickets
- ✅ Chat session joining
- ✅ Chat session leaving
- ✅ Chat session disconnection

### System Information Captured
- ✅ Timestamp
- ✅ User ID and name
- ✅ User type (customer/agent/system)
- ✅ Action performed
- ✅ Ticket number reference
- ✅ Target type and ID
- ✅ IP address
- ✅ User agent
- ✅ Country (prepared for geolocation)
- ✅ Action details
- ✅ Success/failure status

## Access Control

### Role-Based Permissions
- **Admin**: Full audit trail access
- **Tier2**: Full audit trail access
- **Tier1**: No audit trail access
- **Viewer**: No audit trail access

### Permission Check
The `audit.view` permission controls access to:
- Audit trail tab in user management
- Audit logs API endpoints
- Audit statistics

## API Endpoints

### GET /api/audit
Retrieves audit logs with filtering and pagination.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50)
- `search`: Search term for user names, actions, tickets
- `startDate`: Filter by start date
- `endDate`: Filter by end date
- `userType`: Filter by user type (agent/customer/system)
- `action`: Filter by specific action
- `status`: Filter by status (success/failed/warning)

### GET /api/audit/stats
Returns audit log statistics including:
- Total events
- Events in last 24 hours
- Events in last 7 days
- Breakdown by user type
- Breakdown by status
- Top 10 actions

## Frontend Features

### Search and Filtering
- **Text search**: Search across user names, actions, ticket numbers, and details
- **Date range filtering**: Filter events by date/time range
- **User type filtering**: Show only agent, customer, or system events
- **Action filtering**: Filter by specific action types
- **Status filtering**: Filter by success, failed, or warning events

### Display Features
- **Compact table format**: Efficient use of screen space
- **Color-coded actions**: Visual distinction between action types
- **Status indicators**: Clear success/failure indicators
- **Responsive design**: Works on desktop and mobile
- **Pagination**: Handle large numbers of audit entries
- **Real-time statistics**: Overview cards showing key metrics

### User Experience
- **One-click filtering**: Quick filter buttons for common searches
- **Clear filters option**: Reset all filters with one click
- **Sortable columns**: Click to sort by different fields
- **Hover details**: Full details on hover for truncated text
- **Export capability**: Prepared for CSV/Excel export

## Security Considerations

### Access Control
- Permission-based access only
- Failed access attempts are logged
- No sensitive data exposed in logs

### Data Privacy
- IP addresses are captured but can be anonymized
- User agents are logged for security analysis
- Personal information is limited to names only

### Audit Integrity
- Audit logs are append-only
- No deletion of audit entries through UI
- Timestamps are server-controlled

## Implementation Details

### Backend Structure
```javascript
// Audit log entry structure
{
  id: "uuid",
  timestamp: "ISO date",
  userId: "user uuid or null",
  userName: "display name",
  userType: "customer|agent|system",
  action: "action_name",
  ticketNumber: "TKT-123456 or null",
  targetType: "ticket|message|user|session",
  targetId: "target uuid",
  ipAddress: "IP address",
  userAgent: "browser info",
  country: "country code",
  details: "action description",
  status: "success|failed|warning"
}
```

### Key Functions
- `logAudit(params)`: Central logging function
- `getClientIP(req)`: Extract client IP from request
- Automatic integration in all major endpoints

### Storage
- In-memory storage for demo (easily replaceable with database)
- 10,000 entry limit to prevent memory issues
- Prepared for database persistence

## Setup Instructions

### 1. Database Migration
```sql
-- Run the migration file
source database/migration_add_audit_permission.sql
```

### 2. Update Role Permissions
The audit.view permission is automatically added to Admin and Tier2 roles.

### 3. Frontend Access
- Login as an Admin or Tier2 user
- Navigate to User Management
- Click on "Audit Trail" tab

## Future Enhancements

### Planned Features
- [ ] CSV/Excel export functionality
- [ ] Email alerts for critical events
- [ ] Automated report generation
- [ ] Advanced analytics dashboard
- [ ] Geolocation integration
- [ ] Log retention policies
- [ ] Database-backed storage

### Scalability Considerations
- Database indexing for performance
- Log archiving strategies
- API rate limiting
- Caching for statistics

## Testing

### Demo Data
- 50 sample audit log entries generated on startup
- Variety of actions and users represented
- Mixed success/failure statuses
- Date range over last 7 days

### Test Scenarios
1. **Permission Testing**: Verify role-based access
2. **Search Testing**: Test all filter combinations
3. **Performance Testing**: Large dataset handling
4. **Security Testing**: Access control validation

## Maintenance

### Regular Tasks
- Monitor audit log storage usage
- Review failed login attempts
- Check for unusual activity patterns
- Update user access permissions as needed

### Monitoring
- Track audit trail access patterns
- Monitor system performance impact
- Review log retention needs
- Validate data integrity

## Conclusion

The audit trail system provides comprehensive logging and monitoring capabilities for the NeuroChat application. It offers administrators visibility into system usage, security events, and user activities while maintaining appropriate access controls and data privacy considerations.

The implementation is scalable, secure, and user-friendly, providing both detailed logging capabilities and an intuitive interface for reviewing system activities. 