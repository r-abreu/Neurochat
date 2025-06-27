# Auto-Claim on Agent Typing Implementation

## Overview
This implementation adds automatic ticket claiming functionality when agents start typing in the ticket view. When an agent begins typing a message in an unassigned ticket (or a ticket assigned to AI), the system automatically claims the ticket to that agent and changes the status to "in progress".

## Features Implemented

### 1. Backend Auto-Claim Logic (`backend/server.js`)
- **Enhanced typing_start Socket Event**: Modified the existing typing indicator to include auto-claim logic
- **Intelligent Claiming**: Only claims tickets that are unassigned or assigned to the NeuroAI agent
- **Permission Checking**: Verifies agent has `tickets.edit` permission before auto-claiming
- **Status Update**: Automatically changes ticket status to `in_progress` when claimed
- **Audit Logging**: Logs auto-claim actions for audit trail
- **Real-time Notifications**: Emits socket events to notify all connected clients

### 2. Frontend Typing Detection (`frontend/src/components/tickets/TicketDetail.tsx`)
- **Input Change Handling**: Detects when agents start typing in the message input
- **Typing Timeout**: Uses 2-second timeout to stop typing detection after inactivity
- **Agent-Only Triggering**: Only triggers for users with agent role/userType
- **Socket Events**: Emits `typing_start` and `typing_stop` events via SocketService
- **Cleanup**: Properly cleans up typing state when messages are sent or component unmounts

### 3. Real-time Event Handling
- **ticket_claimed Event**: New socket event for auto-claim notifications
- **Automatic UI Refresh**: Updates ticket display when auto-claim occurs
- **Console Logging**: Detailed logging for debugging auto-claim behavior

## Technical Implementation Details

### Backend Socket Event Handler
```javascript
socket.on('typing_start', (data) => {
  // Emit typing indicator to other users
  socket.to(`ticket_${data.ticketId}`).emit('user_typing', {
    ticketId: data.ticketId,
    isTyping: true
  });

  // Check if socket belongs to an agent
  const agentId = socketToAgentMap.get(socket.id);
  if (agentId) {
    const ticket = tickets.find(t => t.id === data.ticketId);
    
    // Auto-claim conditions:
    // 1. Ticket unassigned OR assigned to AI
    // 2. Agent has tickets.edit permission
    const shouldAutoClaim = !ticket.agentId || ticket.agentId === neuroAIAgentId;
    
    if (shouldAutoClaim) {
      // Update ticket assignment and status
      ticket.agentId = agentId;
      ticket.status = 'in_progress';
      ticket.assignedAt = new Date().toISOString();
      
      // Emit notifications and audit log
      // ...
    }
  }
});
```

### Frontend Typing Detection
```typescript
const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const value = e.target.value;
  setNewMessage(value);

  // Only trigger for agents
  if (user?.role === 'agent' || user?.userType === 'agent') {
    if (!isAgentTyping && value.length > 0) {
      setIsAgentTyping(true);
      socketService.startTyping(ticket.id);
    }
    
    // Reset timeout on each keystroke
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsAgentTyping(false);
      socketService.stopTyping(ticket.id);
    }, 2000);
  }
};
```

## Auto-Claim Conditions

The system will auto-claim a ticket when ALL of the following conditions are met:

1. **Agent is Typing**: An authenticated agent starts typing in the message input
2. **Ticket is Available**: Ticket is either:
   - Completely unassigned (`agentId` is null/undefined)
   - Assigned to the NeuroAI agent (allowing human takeover)
3. **Agent Has Permission**: Agent has `tickets.edit` permission
4. **Not Already Claimed**: Ticket is not already assigned to a human agent

## Socket Events

### New Events Added
- **ticket_claimed**: Emitted when a ticket is claimed (manual or auto)
  ```javascript
  {
    ticketId: string,
    agent: { id, firstName, lastName },
    claimedAt: string,
    handoffFromAI?: boolean,
    autoClaimed?: boolean  // Flag indicating auto-claim
  }
  ```

### Enhanced Events
- **ticket_updated**: Now includes `autoClaimed` flag when applicable
- **typing_start**: Enhanced to trigger auto-claim logic

## Testing

### Test Script: `test_auto_claim_typing.ps1`
- Creates an unassigned test ticket
- Provides instructions for manual testing
- Includes verification endpoints

### Manual Testing Steps
1. Run the test script to create a test ticket
2. Login as agent in the frontend
3. Navigate to the test ticket
4. Start typing in the message input field
5. Verify ticket auto-claims and status changes to "in progress"

### Expected Behavior
- ✅ Ticket automatically assigned to typing agent
- ✅ Status changes from "new" to "in_progress"  
- ✅ Real-time notifications sent to all users
- ✅ Audit log entry created
- ✅ UI updates immediately
- ✅ Works for unassigned tickets
- ✅ Works for AI-assigned tickets (human takeover)
- ❌ Does not claim tickets already assigned to human agents

## Benefits

1. **Improved Efficiency**: Agents don't need to manually claim tickets before responding
2. **Faster Response Times**: Tickets are immediately marked as in progress
3. **Seamless AI Handoff**: Smooth transition when agents take over from AI
4. **Better User Experience**: Automatic assignment feels natural and intuitive
5. **Audit Trail**: All auto-claims are logged for accountability

## Edge Cases Handled

1. **Permission Checks**: Only agents with proper permissions can auto-claim
2. **Already Assigned**: Won't steal tickets from other human agents
3. **Typing Timeout**: Typing state resets after 2 seconds of inactivity
4. **Message Send**: Typing state immediately cleared when message is sent
5. **Component Cleanup**: Proper cleanup prevents memory leaks
6. **AI Transition**: Proper handling when taking over from NeuroAI agent

## Configuration

No additional configuration required. The feature uses existing:
- User permissions system (`tickets.edit`)
- Socket.IO infrastructure
- Agent session tracking
- Audit logging system

## Future Enhancements

Potential improvements for future versions:
1. Configurable typing timeout duration
2. Visual indicators for auto-claimed tickets
3. Undo auto-claim functionality
4. Auto-claim preferences per agent
5. Team-based auto-claim rules 