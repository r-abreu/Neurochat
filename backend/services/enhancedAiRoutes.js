const express = require('express');
const router = express.Router();
const enhancedAiService = require('./enhancedAiService');

// Apply authentication middleware to all routes
router.use((req, res, next) => {
  // This will be added when integrating with main server
  next();
});

/**
 * POST /api/ai/feedback
 * Submit feedback for an AI response
 */
router.post('/feedback', async (req, res) => {
  try {
    const { messageId, ticketId, feedback, agentRewrite } = req.body;
    
    if (!messageId || !ticketId || !feedback) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'messageId, ticketId, and feedback are required' }
      });
    }

    if (!['helpful', 'unhelpful', 'needs_improvement'].includes(feedback)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'feedback must be helpful, unhelpful, or needs_improvement' }
      });
    }

    await enhancedAiService.logAIFeedback(messageId, ticketId, feedback, agentRewrite);

    res.json({
      success: true,
      data: { 
        message: 'Feedback recorded successfully',
        messageId,
        feedback
      }
    });

  } catch (error) {
    console.error('Error submitting AI feedback:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to submit feedback' }
    });
  }
});

/**
 * GET /api/ai/context/:ticketId
 * Get the current context for a ticket
 */
router.get('/context/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params;
    
    // In a real implementation, you'd fetch messages and ticket data from database
    const mockTicketData = { id: ticketId };
    const mockMessages = [];
    
    const context = await enhancedAiService.getTicketContext(ticketId, mockMessages, mockTicketData);

    res.json({
      success: true,
      data: { context }
    });

  } catch (error) {
    console.error('Error fetching ticket context:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch context' }
    });
  }
});

/**
 * GET /api/ai/troubleshooting-flows
 * Get available troubleshooting flows
 */
router.get('/troubleshooting-flows', async (req, res) => {
  try {
    const flows = Array.from(enhancedAiService.troubleshootingFlows.values()).map(flow => ({
      id: flow.id,
      name: flow.name,
      deviceModel: flow.deviceModel,
      stepCount: flow.steps.length
    }));

    res.json({
      success: true,
      data: { flows }
    });

  } catch (error) {
    console.error('Error fetching troubleshooting flows:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch troubleshooting flows' }
    });
  }
});

/**
 * POST /api/ai/troubleshooting-flows/:flowId/execute
 * Execute a step in a troubleshooting flow
 */
router.post('/troubleshooting-flows/:flowId/execute', async (req, res) => {
  try {
    const { flowId } = req.params;
    const { ticketId, stepNumber, userResponse } = req.body;
    
    if (!ticketId || !stepNumber) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'ticketId and stepNumber are required' }
      });
    }

    const result = await enhancedAiService.executeTroubleshootingStep(
      ticketId, 
      flowId, 
      stepNumber, 
      userResponse
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND', message: 'Troubleshooting flow or step not found' }
      });
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error executing troubleshooting step:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to execute troubleshooting step' }
    });
  }
});

/**
 * POST /api/ai/enhanced-response
 * Generate an enhanced AI response with improved formatting
 */
router.post('/enhanced-response', async (req, res) => {
  try {
    const { ticketId, userMessage, config, ticketData, messages, contextDocuments } = req.body;
    
    if (!ticketId || !userMessage || !config) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'ticketId, userMessage, and config are required' }
      });
    }

    const result = await enhancedAiService.generateEnhancedResponse(
      userMessage,
      config,
      ticketId,
      messages || [],
      ticketData || {},
      contextDocuments || []
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error generating enhanced response:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to generate enhanced response' }
    });
  }
});

/**
 * POST /api/ai/analyze-clarity
 * Analyze and optimize response clarity
 */
router.post('/analyze-clarity', async (req, res) => {
  try {
    const { response } = req.body;
    
    if (!response) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'response text is required' }
      });
    }

    const analysis = await enhancedAiService.optimizeResponseClarity(response);

    res.json({
      success: true,
      data: analysis
    });

  } catch (error) {
    console.error('Error analyzing response clarity:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to analyze clarity' }
    });
  }
});

/**
 * GET /api/ai/memory/:ticketId
 * Get context memory for a ticket
 */
router.get('/memory/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params;
    
    const memory = enhancedAiService.getContextMemory(ticketId);

    res.json({
      success: true,
      data: { memory }
    });

  } catch (error) {
    console.error('Error fetching context memory:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch context memory' }
    });
  }
});

/**
 * POST /api/ai/check-duplicate
 * Check if a question is a duplicate
 */
router.post('/check-duplicate', async (req, res) => {
  try {
    const { ticketId, question } = req.body;
    
    if (!ticketId || !question) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'ticketId and question are required' }
      });
    }

    const result = await enhancedAiService.checkForDuplicateQuestions(ticketId, question);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error checking for duplicate questions:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to check for duplicates' }
    });
  }
});

/**
 * GET /api/ai/stats
 * Get enhanced AI statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = enhancedAiService.getAIStats();

    res.json({
      success: true,
      data: { stats }
    });

  } catch (error) {
    console.error('Error fetching AI stats:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch stats' }
    });
  }
});

/**
 * POST /api/ai/troubleshooting-flows
 * Create a new troubleshooting flow (Admin only)
 */
router.post('/troubleshooting-flows', async (req, res) => {
  try {
    const { issuePattern, deviceModel, name, description, steps } = req.body;
    
    if (!issuePattern || !name || !steps) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'issuePattern, name, and steps are required' }
      });
    }

    // Create new flow
    const flowId = `custom-${Date.now()}`;
    const newFlow = {
      id: flowId,
      pattern: new RegExp(issuePattern, 'i'),
      deviceModel,
      name,
      description,
      steps
    };

    enhancedAiService.troubleshootingFlows.set(flowId, newFlow);

    res.json({
      success: true,
      data: { 
        flowId,
        message: 'Troubleshooting flow created successfully'
      }
    });

  } catch (error) {
    console.error('Error creating troubleshooting flow:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create troubleshooting flow' }
    });
  }
});

/**
 * GET /api/ai/message-classification/:messageId
 * Get AI message classification and metadata
 */
router.get('/message-classification/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    
    // In a real implementation, you'd fetch from ai_message_tag table
    const mockClassification = {
      messageId,
      messageType: 'instruction',
      intentCategory: 'troubleshooting',
      clarityScore: 0.85,
      helpfulnessScore: 0.90,
      containsJargon: false,
      sentenceCount: 3,
      wordCount: 45,
      agentFeedback: null,
      customerSatisfaction: null
    };

    res.json({
      success: true,
      data: { classification: mockClassification }
    });

  } catch (error) {
    console.error('Error fetching message classification:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch message classification' }
    });
  }
});

module.exports = router; 