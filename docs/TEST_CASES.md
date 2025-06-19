# NeuroChat Ticketing System - Test Cases

## Test Coverage Overview

This document contains comprehensive test cases for the NeuroChat ticketing system covering:
- ✅ Ticket Creation (Web Form & Chat Input)
- ✅ Agent Claiming and Updating Tickets
- ✅ Real-time Chat Delivery and Display
- ✅ User Authentication and Permission Control

**Test Environment:** Development/Staging
**Browser Support:** Chrome, Firefox, Safari, Edge
**Mobile Support:** iOS Safari, Android Chrome

---

## 1. TICKET CREATION TEST CASES

### TC-001: Create Ticket via Web Form - Valid Data
**Type:** Automated  
**Priority:** High  
**Description:** Verify customer can create a ticket using the web form with valid data

**Pre-conditions:**
- Customer is logged in
- Customer dashboard is loaded

**Test Steps:**
1. Navigate to "Create Ticket" page
2. Enter ticket title: "Login issues with mobile app"
3. Enter description: "Cannot access my account after recent app update"
4. Select category: "Software"
5. Select priority: "Medium"
6. Click "Create Ticket" button

**Expected Result:**
- Ticket is created successfully
- Unique ticket number is generated (format: TKT-XXXXXX)
- Success message is displayed
- Customer is redirected to ticket details page
- Ticket status is set to "New"
- Email notification is sent to customer

---

### TC-002: Create Ticket via Web Form - Empty Required Fields
**Type:** Automated  
**Priority:** High  
**Description:** Verify validation when required fields are empty

**Pre-conditions:**
- Customer is logged in
- Create ticket form is loaded

**Test Steps:**
1. Navigate to "Create Ticket" page
2. Leave title field empty
3. Leave description field empty
4. Click "Create Ticket" button

**Expected Result:**
- Form validation errors are displayed
- Error message: "Title is required"
- Error message: "Description is required"
- Ticket is not created
- Form remains on the same page

---

### TC-003: Create Ticket via Web Form - Maximum Character Limits
**Type:** Automated  
**Priority:** Medium  
**Description:** Verify character limit validation for title and description fields

**Pre-conditions:**
- Customer is logged in
- Create ticket form is loaded

**Test Steps:**
1. Navigate to "Create Ticket" page
2. Enter title with 201 characters (exceeds 200 limit)
3. Enter description with 5001 characters (exceeds 5000 limit)
4. Select category: "General"
5. Click "Create Ticket" button

**Expected Result:**
- Validation error: "Title must be 200 characters or less"
- Validation error: "Description must be 5000 characters or less"
- Character counter shows exceeded limits
- Ticket is not created

---

### TC-004: Create Ticket via Chat Input - Valid Message
**Type:** Manual  
**Priority:** High  
**Description:** Verify ticket creation through chat interface with valid message

**Pre-conditions:**
- Customer is logged in
- Chat interface is loaded
- No active ticket exists

**Test Steps:**
1. Navigate to chat interface
2. Type message: "I need help with my billing account"
3. Press Enter or click Send button
4. Select category from popup: "Billing"
5. Confirm ticket creation

**Expected Result:**
- New ticket is created automatically
- Ticket number is displayed in chat
- Message appears as first message in ticket
- Ticket status is "New"
- Agent pool is notified of new ticket

---

### TC-005: Create Ticket with File Attachment
**Type:** Manual  
**Priority:** Medium  
**Description:** Verify ticket creation with file attachment

**Pre-conditions:**
- Customer is logged in
- Create ticket form is loaded

**Test Steps:**
1. Navigate to "Create Ticket" page
2. Fill in required fields (title, description, category)
3. Click "Attach File" button
4. Select valid image file (PNG, 2MB)
5. Click "Create Ticket" button

**Expected Result:**
- File is uploaded successfully
- File appears in attachment list
- Ticket is created with attachment
- File is accessible in ticket details
- File size and type are validated

---

### TC-006: Create Ticket with Invalid File Type
**Type:** Automated  
**Priority:** Medium  
**Description:** Verify file type validation during ticket creation

**Pre-conditions:**
- Customer is logged in
- Create ticket form is loaded

**Test Steps:**
1. Navigate to "Create Ticket" page
2. Fill in required fields
3. Attempt to attach executable file (.exe)
4. Click "Create Ticket" button

**Expected Result:**
- Error message: "File type not allowed"
- File is not uploaded
- List of allowed file types is displayed
- Ticket creation is blocked until valid file is selected

---

## 2. AGENT CLAIMING AND UPDATING TICKETS

### TC-007: Agent Claims New Ticket
**Type:** Automated  
**Priority:** High  
**Description:** Verify agent can claim an unassigned ticket

**Pre-conditions:**
- Agent is logged in with online status
- Unassigned ticket exists in queue
- Agent dashboard is loaded

**Test Steps:**
1. Navigate to "Ticket Queue" tab
2. Locate unassigned ticket in "New" status
3. Click "Claim" button on ticket
4. Confirm claim action in popup

**Expected Result:**
- Ticket status changes to "In Progress"
- Agent is assigned to ticket
- Ticket moves to "Active Tickets" tab
- Customer receives notification about agent assignment
- Ticket assignment timestamp is recorded

---

### TC-008: Agent Updates Ticket Status
**Type:** Automated  
**Priority:** High  
**Description:** Verify agent can update ticket status

**Pre-conditions:**
- Agent is logged in
- Agent has claimed ticket
- Ticket is in "In Progress" status

**Test Steps:**
1. Navigate to "Active Tickets" tab
2. Open ticket details
3. Change status from "In Progress" to "Resolved"
4. Add resolution comment: "Issue fixed by clearing cache"
5. Click "Update" button

**Expected Result:**
- Ticket status updates to "Resolved"
- Resolution timestamp is recorded
- History log shows status change
- Customer receives notification
- Ticket appears in resolved tickets list

---

### TC-009: Agent Updates Ticket Priority
**Type:** Manual  
**Priority:** Medium  
**Description:** Verify agent can change ticket priority

**Pre-conditions:**
- Agent is logged in
- Agent has claimed ticket
- Ticket exists with "Medium" priority

**Test Steps:**
1. Open ticket details page
2. Click on priority dropdown
3. Change priority from "Medium" to "High"
4. Add reason: "Customer reports business impact"
5. Click "Save Changes"

**Expected Result:**
- Priority updates to "High"
- Ticket moves higher in queue sorting
- History log records priority change
- Change reason is saved
- Customer is notified of priority change

---

### TC-010: Agent Reassigns Ticket Category
**Type:** Automated  
**Priority:** Medium  
**Description:** Verify agent can reassign ticket to different category

**Pre-conditions:**
- Agent is logged in
- Ticket exists in "Software" category
- Agent has permission to change categories

**Test Steps:**
1. Open ticket details
2. Click category dropdown
3. Select "Hardware" category
4. Add reason: "Issue related to hardware failure"
5. Save changes

**Expected Result:**
- Ticket category updates to "Hardware"
- Routing rules apply new category
- History shows category change
- Specialized hardware agents are notified
- Category-specific workflows are triggered

---

### TC-011: Agent Cannot Claim Already Assigned Ticket
**Type:** Automated  
**Priority:** High  
**Description:** Verify agents cannot claim tickets already assigned to others

**Pre-conditions:**
- Two agents are logged in (Agent A, Agent B)
- Ticket is already assigned to Agent A
- Agent B views ticket queue

**Test Steps:**
1. Agent B navigates to ticket queue
2. Locates ticket assigned to Agent A
3. Attempts to click "Claim" button

**Expected Result:**
- "Claim" button is disabled or not visible
- Message displays: "Ticket already assigned to [Agent Name]"
- No action is performed
- Ticket remains assigned to original agent

---

### TC-012: Agent Bulk Update Multiple Tickets
**Type:** Manual  
**Priority:** Low  
**Description:** Verify agent can update multiple tickets simultaneously

**Pre-conditions:**
- Agent is logged in
- Multiple tickets are assigned to agent
- Tickets are in "In Progress" status

**Test Steps:**
1. Navigate to "Active Tickets" tab
2. Select 3 tickets using checkboxes
3. Click "Bulk Actions" dropdown
4. Select "Update Status" → "Resolved"
5. Add bulk comment: "Issues resolved during maintenance"
6. Confirm bulk update

**Expected Result:**
- All selected tickets update to "Resolved" status
- Same comment is added to all tickets
- History logs show bulk update
- Customers receive individual notifications
- Agent workload statistics are updated

---

## 3. REAL-TIME CHAT DELIVERY AND DISPLAY

### TC-013: Real-time Message Delivery - Customer to Agent
**Type:** Manual  
**Priority:** High  
**Description:** Verify messages are delivered in real-time from customer to agent

**Pre-conditions:**
- Customer and Agent are logged in
- Active ticket exists with both users in chat
- Both browsers are open and connected

**Test Steps:**
1. Customer types message: "Hello, I need help"
2. Customer presses Enter to send
3. Observe agent's chat window

**Expected Result:**
- Message appears instantly in agent's chat (< 2 seconds)
- Message shows correct timestamp
- Customer name/avatar is displayed
- Message status shows as "Delivered"
- Sound notification plays for agent (if enabled)

---

### TC-014: Real-time Message Delivery - Agent to Customer
**Type:** Manual  
**Priority:** High  
**Description:** Verify messages are delivered in real-time from agent to customer

**Pre-conditions:**
- Customer and Agent are logged in
- Active ticket chat is open for both users
- WebSocket connections are established

**Test Steps:**
1. Agent types message: "Hi! I'm here to help you"
2. Agent clicks Send button
3. Observe customer's chat window

**Expected Result:**
- Message appears instantly in customer's chat
- Agent name and status are displayed
- Message timestamp is accurate
- Message is marked as "Delivered" to agent
- Customer receives browser notification (if enabled)

---

### TC-015: Typing Indicator Functionality
**Type:** Manual  
**Priority:** Medium  
**Description:** Verify typing indicators work correctly in real-time chat

**Pre-conditions:**
- Customer and Agent are in active chat
- Both chat windows are open
- WebSocket connections are active

**Test Steps:**
1. Customer starts typing in message input
2. Observe agent's chat window
3. Customer stops typing for 3 seconds
4. Observe agent's chat window again

**Expected Result:**
- "Customer is typing..." indicator appears for agent
- Typing indicator includes animated dots
- Indicator disappears after 3 seconds of inactivity
- Multiple users typing shows "Customer and Agent are typing..."

---

### TC-016: Message Read Receipts
**Type:** Automated  
**Priority:** Medium  
**Description:** Verify read receipts are displayed correctly

**Pre-conditions:**
- Agent sends message to customer
- Customer chat window is closed initially

**Test Steps:**
1. Agent sends message: "Please check your email"
2. Verify message status shows "Delivered"
3. Customer opens chat window
4. Customer views the message
5. Observe message status change

**Expected Result:**
- Message initially shows "Delivered" status
- When customer views message, status changes to "Read"
- Read timestamp is recorded
- Agent sees "Read at [timestamp]" indicator

---

### TC-017: Chat History Persistence
**Type:** Automated  
**Priority:** High  
**Description:** Verify chat history is maintained across sessions

**Pre-conditions:**
- Customer and Agent have exchanged 10 messages
- Customer logs out and logs back in

**Test Steps:**
1. Customer sends message: "This is message 1"
2. Agent replies: "This is reply 1"
3. Continue conversation with 8 more exchanges
4. Customer logs out
5. Customer logs back in
6. Navigate to ticket chat
7. Scroll up to view message history

**Expected Result:**
- All 10 messages are visible in correct order
- Message timestamps are preserved
- Message status indicators are maintained
- Scroll position allows viewing full history
- No messages are lost or duplicated

---

### TC-018: Concurrent Multiple Chat Windows
**Type:** Manual  
**Priority:** Medium  
**Description:** Verify agent can handle multiple chat sessions simultaneously

**Pre-conditions:**
- Agent is logged in
- Agent has 3 active tickets assigned
- All 3 customers are online and chatting

**Test Steps:**
1. Open chat for Ticket A
2. Open chat for Ticket B in new tab
3. Open chat for Ticket C in new tab
4. Send message in Ticket A chat
5. Switch to Ticket B and send message
6. Verify messages in both chats

**Expected Result:**
- All 3 chat windows function independently
- Messages are delivered to correct recipients
- No cross-contamination between chats
- Typing indicators work for each chat
- Browser notifications specify correct ticket

---

### TC-019: Network Disconnection and Reconnection
**Type:** Manual  
**Priority:** High  
**Description:** Verify chat functionality during network interruptions

**Pre-conditions:**
- Customer and Agent are in active chat
- Network connection is stable

**Test Steps:**
1. Customer sends message: "Test message 1"
2. Disable customer's network connection
3. Customer attempts to send: "Test message 2"
4. Re-enable network connection after 30 seconds
5. Observe message delivery and chat state

**Expected Result:**
- Message 1 is delivered normally
- Message 2 shows "Sending..." status during disconnection
- Connection status indicator shows "Disconnected"
- After reconnection, message 2 is delivered
- Chat history remains intact
- No messages are lost

---

### TC-020: File Sharing in Chat
**Type:** Manual  
**Priority:** Medium  
**Description:** Verify file sharing functionality within chat

**Pre-conditions:**
- Customer and Agent are in active chat
- File upload is enabled

**Test Steps:**
1. Customer clicks file attachment button in chat
2. Select image file (screenshot.png, 1.5MB)
3. Add message: "Here's the error screenshot"
4. Send message with attachment
5. Agent views the attachment

**Expected Result:**
- File uploads successfully with progress indicator
- Image thumbnail appears in chat for both users
- Agent can view full-size image by clicking
- File download link is available
- File size and type are displayed
- Upload time is reasonable (< 10 seconds)

---

## 4. USER AUTHENTICATION AND PERMISSION CONTROL

### TC-021: Customer Login with Valid Credentials
**Type:** Automated  
**Priority:** High  
**Description:** Verify customer can login with correct email and password

**Pre-conditions:**
- Customer account exists in database
- Login page is loaded
- No active session exists

**Test Steps:**
1. Navigate to login page
2. Enter email: "customer@example.com"
3. Enter password: "ValidPassword123"
4. Click "Login" button

**Expected Result:**
- Login is successful
- JWT tokens are generated and stored
- User is redirected to customer dashboard
- Session is established
- Last login timestamp is updated
- User menu shows customer name

---

### TC-022: Agent Login with Valid Credentials
**Type:** Automated  
**Priority:** High  
**Description:** Verify agent can login and access agent dashboard

**Pre-conditions:**
- Agent account exists with proper role
- Login page is loaded

**Test Steps:**
1. Navigate to login page
2. Enter agent email: "agent@example.com"
3. Enter password: "AgentPassword123"
4. Click "Login" button

**Expected Result:**
- Login successful with agent role
- Redirected to agent dashboard
- Agent-specific navigation menu is visible
- Ticket queue is accessible
- Agent status is set to "Online"
- Analytics section is available

---

### TC-023: Login with Invalid Credentials
**Type:** Automated  
**Priority:** High  
**Description:** Verify system rejects invalid login attempts

**Pre-conditions:**
- Login page is loaded
- Invalid credentials are used

**Test Steps:**
1. Navigate to login page
2. Enter email: "invalid@example.com"
3. Enter password: "WrongPassword"
4. Click "Login" button

**Expected Result:**
- Login is rejected
- Error message: "Invalid email or password"
- User remains on login page
- No session is created
- Login attempt is logged
- Account is not locked after single attempt

---

### TC-024: Account Lockout After Multiple Failed Attempts
**Type:** Automated  
**Priority:** High  
**Description:** Verify account lockout mechanism after repeated failed logins

**Pre-conditions:**
- Valid user account exists
- Account lockout is configured (5 attempts)

**Test Steps:**
1. Attempt login with wrong password 5 times
2. Use correct credentials on 6th attempt
3. Verify account status

**Expected Result:**
- After 5 failed attempts, account is locked
- Error message: "Account locked due to multiple failed attempts"
- Correct credentials are rejected while locked
- Account unlock email is sent
- Security event is logged
- Lockout duration is enforced (15 minutes)

---

### TC-025: Customer Access Control - Agent Features
**Type:** Automated  
**Priority:** High  
**Description:** Verify customers cannot access agent-only features

**Pre-conditions:**
- Customer is logged in
- Customer session is active

**Test Steps:**
1. Attempt to navigate to agent dashboard URL directly
2. Try to access ticket queue endpoint
3. Attempt to claim a ticket via API
4. Try to access analytics page

**Expected Result:**
- All agent URLs redirect to unauthorized page
- API calls return 403 Forbidden status
- Error message: "Insufficient permissions"
- Customer is redirected to customer dashboard
- Security violation is logged

---

### TC-026: Agent Access Control - Customer Data
**Type:** Automated  
**Priority:** High  
**Description:** Verify agents can only access appropriate ticket data

**Pre-conditions:**
- Agent A and Agent B are logged in
- Ticket X is assigned to Agent A only

**Test Steps:**
1. Agent B attempts to view Ticket X details
2. Agent B tries to update Ticket X via API
3. Agent B attempts to join Ticket X chat room

**Expected Result:**
- Agent B cannot view unassigned ticket details
- API calls return 403 Forbidden for unauthorized tickets
- WebSocket connection to unauthorized ticket is rejected
- Agent can only see tickets assigned to them or unassigned
- Access attempts are logged

---

### TC-027: Session Timeout Handling
**Type:** Manual  
**Priority:** Medium  
**Description:** Verify user session expires after configured timeout period

**Pre-conditions:**
- User is logged in
- Session timeout is set to 30 minutes
- User is idle

**Test Steps:**
1. Login as customer
2. Navigate to dashboard
3. Leave browser idle for 35 minutes
4. Attempt to perform action (create ticket)
5. Observe system response

**Expected Result:**
- After 30 minutes, session expires
- User is redirected to login page
- Error message: "Session expired, please login again"
- Form data is preserved where possible
- Security event is logged

---

### TC-028: JWT Token Refresh
**Type:** Automated  
**Priority:** Medium  
**Description:** Verify automatic token refresh functionality

**Pre-conditions:**
- User is logged in
- Access token expires in 1 hour
- Refresh token is valid

**Test Steps:**
1. Login as customer
2. Wait for access token to near expiration (58 minutes)
3. Perform API call (get tickets)
4. Verify token refresh process

**Expected Result:**
- New access token is automatically obtained
- API call succeeds without interruption
- Refresh token is updated
- User session continues seamlessly
- Token refresh is logged

---

### TC-029: Password Reset Functionality
**Type:** Manual  
**Priority:** Medium  
**Description:** Verify password reset process works correctly

**Pre-conditions:**
- User account exists
- Email service is configured
- User is not logged in

**Test Steps:**
1. Click "Forgot Password" link on login page
2. Enter email: "customer@example.com"
3. Click "Send Reset Link"
4. Check email inbox
5. Click reset link in email
6. Enter new password
7. Confirm password change

**Expected Result:**
- Password reset email is sent within 2 minutes
- Email contains valid reset link with token
- Reset link expires after 24 hours
- New password meets complexity requirements
- Old password is invalidated
- User can login with new password

---

### TC-030: Role-Based Navigation Menu
**Type:** Automated  
**Priority:** Medium  
**Description:** Verify navigation menu shows appropriate options based on user role

**Pre-conditions:**
- Both customer and agent accounts exist

**Test Steps:**
1. Login as customer
2. Observe navigation menu options
3. Logout
4. Login as agent
5. Compare navigation menu options

**Expected Result:**
**Customer Menu:**
- My Tickets
- Create Ticket
- Chat Support
- Profile Settings

**Agent Menu:**
- Dashboard
- Ticket Queue
- Active Tickets
- Analytics
- Agent Profile
- System Settings

---

## Test Execution Summary

### Automation Priority
**High Priority (Automated):** TC-001, TC-002, TC-003, TC-007, TC-008, TC-010, TC-011, TC-016, TC-017, TC-021, TC-022, TC-023, TC-024, TC-025, TC-026, TC-028, TC-030

**Manual Testing Required:** TC-004, TC-005, TC-006, TC-009, TC-012, TC-013, TC-014, TC-015, TC-018, TC-019, TC-020, TC-027, TC-029

### Test Environment Requirements
- **Browsers:** Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile:** iOS 14+, Android 8+
- **Network:** Stable internet connection, WiFi/4G simulation
- **Database:** Test data with sample customers, agents, tickets
- **Email:** Test email server for notifications

### Test Data Requirements
- 10 Customer accounts with various ticket histories
- 5 Agent accounts with different permission levels
- 50 Sample tickets in various states
- File attachments of different types and sizes
- Test categories and priority levels

### Performance Benchmarks
- **Message Delivery:** < 2 seconds
- **Page Load Time:** < 3 seconds
- **File Upload:** < 10 seconds for 5MB files
- **Login Response:** < 1 second
- **Real-time Updates:** < 1 second

This comprehensive test suite ensures the NeuroChat ticketing system meets all functional requirements and provides excellent user experience for both customers and support agents. 