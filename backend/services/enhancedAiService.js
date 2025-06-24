const OpenAI = require('openai');
const natural = require('natural');

class EnhancedAIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || ''
    });
    this.tokenizer = natural.WordTokenizer;
    this.stemmer = natural.PorterStemmer;
    this.isInitialized = false;
    
    // In-memory storage for context (in production, use database)
    this.ticketContextCache = new Map();
    this.troubleshootingFlows = new Map();
    this.contextMemory = new Map();
    
    // Initialize troubleshooting flows
    this.initializeTroubleshootingFlows();
  }

  async initialize() {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️ OpenAI API key not found. AI features will be disabled.');
      return false;
    }
    
    try {
      // Test the API key with a simple request
      await this.openai.models.list();
      this.isInitialized = true;
      console.log('✅ Enhanced AI Service initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Enhanced AI Service:', error.message);
      return false;
    }
  }

  isEnabled() {
    return this.isInitialized && !!process.env.OPENAI_API_KEY;
  }

  // Initialize default troubleshooting flows
  initializeTroubleshootingFlows() {
    const flows = [
      {
        id: 'power-issues',
        pattern: /won't power on|not turning on|no power|dead|not starting|won't start/i,
        deviceModel: null,
        name: 'Device Power Issues',
        steps: [
          {
            step: 1,
            instruction: "Let's walk through a few quick checks to power on your device. Step 1: Make sure the power cord is firmly connected to both your device and the wall outlet.",
            checkPhrase: "Did this solve your issue?",
            nextStepSuccess: 0, // 0 means resolved
            nextStepFailure: 2
          },
          {
            step: 2,
            instruction: "Step 2: Try a different power outlet to rule out outlet issues.",
            checkPhrase: "Did this solve your issue?",
            nextStepSuccess: 0,
            nextStepFailure: 3
          },
          {
            step: 3,
            instruction: "Step 3: Look for any LED lights or indicators on your device. Are you seeing any lights at all?",
            checkPhrase: "Are you seeing any lights?",
            nextStepSuccess: 4,
            nextStepFailure: 5
          },
          {
            step: 4,
            instruction: "If you're seeing lights, your device is getting power but may have a different issue. Let's try a factory reset. Can you locate the reset button on your device?",
            checkPhrase: "Did the reset resolve the issue?",
            nextStepSuccess: 0,
            nextStepFailure: 6
          },
          {
            step: 5,
            instruction: "If there are no lights and we've tried different outlets, this suggests a hardware issue. To proceed with warranty or repair options, I'll need your device's serial number. Can you provide that?",
            checkPhrase: "Can you provide the serial number?",
            nextStepSuccess: -1, // -1 means escalate
            nextStepFailure: -1
          }
        ]
      },
      {
        id: 'connectivity',
        pattern: /connection|connect|wifi|network|bluetooth|pairing|can't connect|won't connect/i,
        deviceModel: null,
        name: 'Connectivity Issues',
        steps: [
          {
            step: 1,
            instruction: "I can help you with connection issues. First, what type of connection are you trying to establish - WiFi, Bluetooth, or USB?",
            checkPhrase: "What type of connection?",
            nextStepSuccess: 2,
            nextStepFailure: 2
          },
          {
            step: 2,
            instruction: "Let's start by restarting your device and the device you're trying to connect to. Please power both devices off for 10 seconds, then power them back on.",
            checkPhrase: "Did this solve your issue?",
            nextStepSuccess: 0,
            nextStepFailure: 3
          },
          {
            step: 3,
            instruction: "Now let's check if your devices are in range and that Bluetooth/WiFi is enabled on both devices. Are both devices showing as available for connection?",
            checkPhrase: "Are both devices showing as available?",
            nextStepSuccess: 4,
            nextStepFailure: 5
          },
          {
            step: 4,
            instruction: "Try forgetting/removing the connection and re-pairing the devices from scratch. This often resolves connection conflicts.",
            checkPhrase: "Did this solve your issue?",
            nextStepSuccess: 0,
            nextStepFailure: -1
          }
        ]
      }
    ];

    flows.forEach(flow => {
      this.troubleshootingFlows.set(flow.id, flow);
    });
  }

  // 🧠 FEATURE 1: Ticket-Based Smart Context
  async getTicketContext(ticketId, messages, ticketData) {
    try {
      let context = this.ticketContextCache.get(ticketId);
      
      if (!context || context.needsRefresh) {
        context = await this.buildTicketContext(ticketId, messages, ticketData);
        this.ticketContextCache.set(ticketId, context);
      }
      
      return context;
    } catch (error) {
      console.error('Error getting ticket context:', error);
      return this.getEmptyContext();
    }
  }

  async buildTicketContext(ticketId, messages, ticketData) {
    // Sort messages by creation time
    const sortedMessages = messages.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // Get last 5 agent/AI responses
    const agentResponses = sortedMessages
      .filter(msg => msg.sender && (msg.sender.userType === 'agent' || msg.sender.userType === 'ai'))
      .slice(-5);

    // Extract issue keywords
    const allContent = messages.map(msg => msg.content).join(' ');
    const keywords = this.extractKeywords(allContent);

    // Determine troubleshooting stage
    const stage = this.determineTroubleshootingStage(messages);

    // Build device info
    const deviceInfo = this.buildDeviceInfo(ticketData);

    // Get linked tickets (customer history)
    const linkedTickets = await this.findLinkedTickets(ticketData);

    // Generate conversation summary
    const summary = await this.generateConversationSummary(messages);

    return {
      ticketId,
      conversationSummary: summary,
      last5Responses: agentResponses,
      issueKeywords: keywords,
      troubleshootingStage: stage,
      deviceInfo,
      customerContext: {
        name: ticketData.customerName,
        email: ticketData.customerEmail,
        company: ticketData.customerCompany,
        customerType: ticketData.customerType
      },
      linkedTickets,
      lastUpdated: new Date().toISOString(),
      contextConfidence: 0.8,
      needsRefresh: false
    };
  }

  // 🧠 FEATURE 2: Duplicate Question Detection
  async checkForDuplicateQuestions(ticketId, proposedQuestion) {
    try {
      const memory = this.getContextMemory(ticketId);
      const questionsAsked = memory.questionsAsked || [];
      
      // Use semantic similarity to check for duplicates
      const questionType = this.classifyQuestionType(proposedQuestion);
      
      // Check if this type of question was already asked
      const isDuplicate = questionsAsked.some(askedQuestion => {
        const askedType = this.classifyQuestionType(askedQuestion);
        return this.calculateTextSimilarity(questionType, askedType) > 0.7;
      });

      if (isDuplicate) {
        return {
          isDuplicate: true,
          suggestion: this.rephraseQuestion(proposedQuestion, questionsAsked)
        };
      }

      // Log the question as asked
      questionsAsked.push(proposedQuestion);
      memory.questionsAsked = questionsAsked;
      this.updateContextMemory(ticketId, memory);

      return { isDuplicate: false };
    } catch (error) {
      console.error('Error checking duplicate questions:', error);
      return { isDuplicate: false };
    }
  }

  // 🧠 FEATURE 3: Context-Aware Troubleshooting Flow
  async findMatchingTroubleshootingFlow(userMessage, deviceModel = null) {
    try {
      for (const [flowId, flow] of this.troubleshootingFlows) {
        // Check if device model matches (if specified)
        if (flow.deviceModel && deviceModel && flow.deviceModel !== deviceModel) {
          continue;
        }

        // Check if message matches the pattern
        if (flow.pattern.test(userMessage)) {
          return {
            flowId,
            flow,
            currentStep: 1
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error finding troubleshooting flow:', error);
      return null;
    }
  }

  async executeTroubleshootingStep(ticketId, flowId, stepNumber, userResponse = null) {
    try {
      const flow = this.troubleshootingFlows.get(flowId);
      if (!flow) return null;

      const step = flow.steps.find(s => s.step === stepNumber);
      if (!step) return null;

      // Track the step in context memory
      const memory = this.getContextMemory(ticketId);
      memory.troubleshootingStepsCompleted = memory.troubleshootingStepsCompleted || [];
      memory.troubleshootingStepsCompleted.push({
        flowId,
        step: stepNumber,
        instruction: step.instruction,
        userResponse,
        timestamp: new Date().toISOString()
      });

      // Determine next step based on user response
      let nextStep = null;
      if (userResponse) {
        const isPositiveResponse = this.isPositiveResponse(userResponse);
        nextStep = isPositiveResponse ? step.nextStepSuccess : step.nextStepFailure;
      }

      this.updateContextMemory(ticketId, memory);

      return {
        currentStep: step,
        nextStep,
        isComplete: nextStep === 0,
        shouldEscalate: nextStep === -1,
        flowId
      };
    } catch (error) {
      console.error('Error executing troubleshooting step:', error);
      return null;
    }
  }

  // 🧠 FEATURE 4: Clarity Optimization Filter
  async optimizeResponseClarity(response) {
    try {
      let optimizedResponse = response;

      // 1. Simplify jargon
      optimizedResponse = this.simplifyJargon(optimizedResponse);

      // 2. Break down long sentences
      optimizedResponse = this.breakLongSentences(optimizedResponse);

      // 3. Convert passive to active voice
      optimizedResponse = this.convertToActiveVoice(optimizedResponse);

      // 4. Replace vague phrases
      optimizedResponse = this.replaceVaguePhrases(optimizedResponse);

      // 5. Add formatting for multiple steps
      optimizedResponse = this.addFormattingForSteps(optimizedResponse);

      return {
        originalResponse: response,
        optimizedResponse,
        clarityScore: this.calculateClarityScore(optimizedResponse),
        optimizations: this.identifyOptimizations(response, optimizedResponse)
      };
    } catch (error) {
      console.error('Error optimizing response clarity:', error);
      return {
        originalResponse: response,
        optimizedResponse: response,
        clarityScore: 0.5,
        optimizations: []
      };
    }
  }

  // 🧠 FEATURE 5: Enhanced Response Generation with Context
  async generateEnhancedResponse(userMessage, config, ticketId, messages, ticketData, contextDocuments = []) {
    if (!this.isEnabled()) {
      throw new Error('AI Service is not available');
    }

    const startTime = Date.now();

    try {
      // Get ticket context
      const context = await this.getTicketContext(ticketId, messages, ticketData);
      
      // Check for duplicate questions
      const duplicateCheck = await this.checkForDuplicateQuestions(ticketId, userMessage);
      if (duplicateCheck.isDuplicate) {
        return {
          response: duplicateCheck.suggestion,
          confidence: 0.9,
          responseType: 'duplicate_rephrase',
          responseTimeMs: Date.now() - startTime
        };
      }

      // Check for troubleshooting flow match
      const flowMatch = await this.findMatchingTroubleshootingFlow(userMessage, ticketData.deviceModel);
      if (flowMatch) {
        const stepResult = await this.executeTroubleshootingStep(ticketId, flowMatch.flowId, 1);
        if (stepResult) {
          return {
            response: stepResult.currentStep.instruction + '\n\n' + stepResult.currentStep.checkPhrase,
            confidence: 0.9,
            responseType: 'troubleshooting_flow',
            flowId: flowMatch.flowId,
            currentStep: 1,
            responseTimeMs: Date.now() - startTime
          };
        }
      }

      // Build enhanced system prompt with context
      const systemPrompt = this.buildEnhancedSystemPrompt(config, context, contextDocuments);

      // Generate AI response
      const completion = await this.openai.chat.completions.create({
        model: config.model || 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 500,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      });

      const aiResponse = completion.choices[0]?.message?.content?.trim();
      
      if (!aiResponse) {
        throw new Error('No response generated');
      }

      // Optimize response clarity
      const clarityOptimization = await this.optimizeResponseClarity(aiResponse);

      // Calculate enhanced confidence
      const confidence = this.calculateEnhancedConfidence(
        clarityOptimization.optimizedResponse, 
        contextDocuments.length,
        context
      );

      // Update context memory
      this.updateConversationHistory(ticketId, userMessage, clarityOptimization.optimizedResponse);

      return {
        response: clarityOptimization.optimizedResponse,
        confidence,
        shouldEscalate: confidence < (config.confidence_threshold || 0.7),
        responseTimeMs: Date.now() - startTime,
        modelUsed: config.model || 'gpt-4o',
        sourceDocuments: contextDocuments.map(doc => doc.id),
        responseType: 'contextual_response',
        clarityScore: clarityOptimization.clarityScore,
        contextUsed: context,
        optimizations: clarityOptimization.optimizations
      };

    } catch (error) {
      console.error('Error generating enhanced AI response:', error);
      throw new Error(`Enhanced AI response generation failed: ${error.message}`);
    }
  }

  // Helper methods for context management
  getContextMemory(ticketId) {
    if (!this.contextMemory.has(ticketId)) {
      this.contextMemory.set(ticketId, {
        questionsAsked: [],
        informationGathered: {},
        troubleshootingStepsCompleted: [],
        customerCommunicationStyle: 'unknown',
        preferredResponseLength: 'detailed',
        escalationTriggers: [],
        primaryIssueCategory: null,
        resolutionAttempts: 0,
        customerFrustrationLevel: 'low',
        lastUpdated: new Date().toISOString(),
        confidenceLevel: 0.5
      });
    }
    return this.contextMemory.get(ticketId);
  }

  updateContextMemory(ticketId, memory) {
    memory.lastUpdated = new Date().toISOString();
    this.contextMemory.set(ticketId, memory);
  }

  updateConversationHistory(ticketId, userMessage, aiResponse) {
    const memory = this.getContextMemory(ticketId);
    
    // Update customer communication style
    memory.customerCommunicationStyle = this.detectCommunicationStyle(userMessage);
    
    // Update frustration level
    memory.customerFrustrationLevel = this.detectFrustrationLevel(userMessage);
    
    // Update resolution attempts
    memory.resolutionAttempts += 1;
    
    this.updateContextMemory(ticketId, memory);
  }

  // Classification and analysis methods
  classifyQuestionType(question) {
    const questionLower = question.toLowerCase();
    
    if (questionLower.includes('power') || questionLower.includes('turn on')) {
      return 'power_related';
    } else if (questionLower.includes('connect') || questionLower.includes('pair')) {
      return 'connectivity';
    } else if (questionLower.includes('setup') || questionLower.includes('install')) {
      return 'setup';
    } else if (questionLower.includes('error') || questionLower.includes('problem')) {
      return 'error_troubleshooting';
    } else if (questionLower.includes('serial') || questionLower.includes('model')) {
      return 'device_info';
    }
    
    return 'general';
  }

  calculateTextSimilarity(text1, text2) {
    // Simple Jaccard similarity
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  rephraseQuestion(originalQuestion, previousQuestions) {
    // Simple rephrasing - in production, use AI to generate better rephrasings
    return `I've asked about this before. Let me approach this differently: ${originalQuestion}`;
  }

  isPositiveResponse(response) {
    const positiveKeywords = ['yes', 'yeah', 'ok', 'okay', 'done', 'completed', 'works', 'fixed', 'solved'];
    const negativeKeywords = ['no', 'nope', 'not', 'still', 'doesn\'t work', 'failed', 'error'];
    
    const responseLower = response.toLowerCase();
    
    const positiveCount = positiveKeywords.filter(keyword => responseLower.includes(keyword)).length;
    const negativeCount = negativeKeywords.filter(keyword => responseLower.includes(keyword)).length;
    
    return positiveCount > negativeCount;
  }

  // Clarity optimization methods
  simplifyJargon(text) {
    const jargonMap = {
      'API': 'connection interface',
      'firmware': 'device software',
      'protocol': 'communication method',
      'initialize': 'start up',
      'authenticate': 'verify identity',
      'configuration': 'settings',
      'parameters': 'settings',
      'execute': 'run',
      'terminate': 'stop'
    };

    let simplified = text;
    for (const [jargon, plain] of Object.entries(jargonMap)) {
      const regex = new RegExp(`\\b${jargon}\\b`, 'gi');
      simplified = simplified.replace(regex, plain);
    }

    return simplified;
  }

  breakLongSentences(text) {
    // Split sentences longer than 20 words
    const sentences = text.split(/[.!?]+/);
    const processedSentences = sentences.map(sentence => {
      const words = sentence.trim().split(/\s+/);
      if (words.length > 20) {
        // Simple split at conjunctions
        const conjunctions = [' and ', ' but ', ' or ', ' so ', ' because '];
        for (const conjunction of conjunctions) {
          if (sentence.includes(conjunction)) {
            return sentence.replace(conjunction, '.' + conjunction.trim().charAt(0).toUpperCase() + conjunction.slice(1));
          }
        }
      }
      return sentence;
    });

    return processedSentences.join('. ').replace(/\.\s*\./g, '.');
  }

  convertToActiveVoice(text) {
    // Simple passive to active voice conversion
    const passivePatterns = [
      { passive: /(\w+) is recommended/g, active: 'I recommend $1' },
      { passive: /it is suggested/g, active: 'I suggest' },
      { passive: /this can be done/g, active: 'you can do this' },
      { passive: /(\w+) should be (\w+)/g, active: 'you should $2 $1' }
    ];

    let converted = text;
    passivePatterns.forEach(pattern => {
      converted = converted.replace(pattern.passive, pattern.active);
    });

    return converted;
  }

  replaceVaguePhrases(text) {
    const vagueReplacements = {
      'It seems like': 'Here\'s what we can try next:',
      'It appears that': 'The issue is likely:',
      'You might want to': 'Try this:',
      'It could be': 'This is probably:',
      'Perhaps': 'Let\'s try:',
      'Maybe': 'Let\'s try:',
      'Possibly': 'This might be:'
    };

    let replaced = text;
    for (const [vague, clear] of Object.entries(vagueReplacements)) {
      const regex = new RegExp(vague, 'gi');
      replaced = replaced.replace(regex, clear);
    }

    return replaced;
  }

  addFormattingForSteps(text) {
    // Add bullet points for multiple steps
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());
    
    if (sentences.length > 2) {
      // Check if they're instructions
      const instructionWords = ['try', 'check', 'make sure', 'verify', 'test', 'click', 'press'];
      const instructionCount = sentences.filter(sentence => 
        instructionWords.some(word => sentence.toLowerCase().includes(word))
      ).length;

      if (instructionCount >= 2) {
        return sentences.map((sentence, index) => {
          if (index === 0) return sentence.trim() + ':';
          return `• ${sentence.trim()}`;
        }).join('\n');
      }
    }

    return text;
  }

  calculateClarityScore(text) {
    let score = 0.5; // Base score

    // Check average sentence length
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());
    const avgSentenceLength = sentences.reduce((sum, sentence) => sum + sentence.split(/\s+/).length, 0) / sentences.length;
    
    if (avgSentenceLength < 15) score += 0.2;
    else if (avgSentenceLength > 25) score -= 0.2;

    // Check for jargon
    const jargonWords = ['API', 'firmware', 'protocol', 'initialize', 'authenticate', 'configuration'];
    const jargonCount = jargonWords.filter(word => text.toLowerCase().includes(word.toLowerCase())).length;
    score -= jargonCount * 0.1;

    // Check for clear structure
    if (text.includes('•') || text.includes('Step')) score += 0.1;

    // Check for positive, direct language
    const positiveWords = ['try', 'let\'s', 'here\'s', 'you can', 'we can'];
    const positiveCount = positiveWords.filter(word => text.toLowerCase().includes(word)).length;
    score += positiveCount * 0.05;

    return Math.max(0.1, Math.min(1.0, score));
  }

  identifyOptimizations(original, optimized) {
    const optimizations = [];
    
    if (original !== optimized) {
      optimizations.push('clarity_improved');
    }
    
    if (optimized.includes('•')) {
      optimizations.push('formatting_added');
    }
    
    if (original.length > optimized.length) {
      optimizations.push('text_simplified');
    }
    
    return optimizations;
  }

  // Enhanced confidence calculation
  calculateEnhancedConfidence(response, contextDocCount, context) {
    let confidence = 0.5; // Base confidence

    // Context availability bonus
    if (context.conversationSummary) confidence += 0.1;
    if (context.deviceInfo) confidence += 0.1;
    if (context.issueKeywords.length > 0) confidence += 0.1;

    // Document relevance bonus
    if (contextDocCount > 0) {
      confidence += 0.2 + (contextDocCount * 0.05);
    }

    // Response quality factors
    const wordCount = response.split(' ').length;
    if (wordCount > 30 && wordCount < 150) confidence += 0.1;

    // Troubleshooting stage consideration
    if (context.troubleshootingStage === 'advanced') confidence += 0.05;

    return Math.max(0.1, Math.min(0.95, confidence));
  }

  // Context building helpers
  extractKeywords(text) {
    const words = text.toLowerCase().split(/\s+/);
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her', 'our', 'their']);
    
    const keywords = words
      .filter(word => word.length > 3 && !stopWords.has(word))
      .reduce((acc, word) => {
        acc[word] = (acc[word] || 0) + 1;
        return acc;
      }, {});

    return Object.entries(keywords)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  determineTroubleshootingStage(messages) {
    const messageCount = messages.length;
    const agentMessages = messages.filter(msg => msg.sender && msg.sender.userType === 'agent').length;
    
    if (messageCount <= 2) return 'initial';
    if (messageCount <= 5) return 'basic';
    if (agentMessages > 3) return 'advanced';
    return 'escalation';
  }

  buildDeviceInfo(ticketData) {
    return {
      model: ticketData.deviceModel,
      serialNumber: ticketData.deviceSerialNumber,
      knownIssues: this.getKnownIssues(ticketData.deviceModel)
    };
  }

  getKnownIssues(deviceModel) {
    const knownIssues = {
      'BWMini': ['Power connection issues', 'Bluetooth pairing problems'],
      'BWIII': ['WiFi connectivity', 'Sensor calibration'],
      'Compass': ['Battery life', 'Mobile app sync'],
      'Maxxi': ['USB connection', 'Software compatibility']
    };
    
    return knownIssues[deviceModel] || [];
  }

  async findLinkedTickets(ticketData) {
    // In production, query database for customer's previous tickets
    return [];
  }

  async generateConversationSummary(messages) {
    if (messages.length === 0) return 'New conversation';
    
    const customerMessages = messages.filter(msg => !msg.sender || msg.sender.userType === 'customer');
    const lastCustomerMessage = customerMessages[customerMessages.length - 1];
    
    return `Customer issue: ${lastCustomerMessage?.content?.substring(0, 100)}...`;
  }

  detectCommunicationStyle(message) {
    const technical = ['API', 'firmware', 'protocol', 'configuration', 'error code'];
    const impatient = ['urgent', 'immediately', 'asap', 'right now', 'quickly'];
    
    const messageLower = message.toLowerCase();
    
    if (technical.some(word => messageLower.includes(word.toLowerCase()))) {
      return 'technical';
    } else if (impatient.some(word => messageLower.includes(word))) {
      return 'impatient';
    } else if (message.length > 200) {
      return 'detailed';
    }
    
    return 'non_technical';
  }

  detectFrustrationLevel(message) {
    const frustrated = ['frustrated', 'annoyed', 'terrible', 'awful', 'hate', 'stupid'];
    const angry = ['angry', 'furious', 'ridiculous', 'unacceptable', 'worst'];
    
    const messageLower = message.toLowerCase();
    
    if (angry.some(word => messageLower.includes(word))) {
      return 'critical';
    } else if (frustrated.some(word => messageLower.includes(word))) {
      return 'high';
    } else if (messageLower.includes('please') && messageLower.includes('help')) {
      return 'medium';
    }
    
    return 'low';
  }

  buildEnhancedSystemPrompt(config, context, documentContext = []) {
    const agentName = config.agent_name || 'NeuroAI';
    const tone = config.response_tone || 'Professional';
    const attitude = config.attitude_style || 'Helpful';

    let contextInfo = '';
    if (context.conversationSummary) {
      contextInfo += `\nConversation context: ${context.conversationSummary}`;
    }
    if (context.deviceInfo?.model) {
      contextInfo += `\nDevice: ${context.deviceInfo.model}`;
      if (context.deviceInfo.knownIssues.length > 0) {
        contextInfo += ` (Known issues: ${context.deviceInfo.knownIssues.join(', ')})`;
      }
    }
    if (context.troubleshootingStage) {
      contextInfo += `\nTroubleshooting stage: ${context.troubleshootingStage}`;
    }

    let documentInfo = '';
    if (documentContext.length > 0) {
      documentInfo = '\n\nRelevant Documentation:\n' + 
        documentContext.map(doc => `- ${doc.text}`).join('\n');
    }

    return `You are ${agentName}, an intelligent AI support assistant for NeuroVirtual.

Your communication style:
- Tone: ${tone}
- Attitude: ${attitude}
- Be helpful, professional, and efficient
- Avoid repeating information already covered
- Provide clear, actionable guidance
- Use bullet points for multiple steps

Context awareness:${contextInfo}

Guidelines:
- Don't ask questions that have already been answered
- Provide step-by-step guidance when appropriate
- End troubleshooting steps with "Did this solve your issue?"
- If customer shows frustration, be extra empathetic
- Stay focused on NeuroVirtual products and services
- Escalate to human agents when needed

${documentInfo}

Remember: You have context about this conversation and should use it to provide more intelligent, personalized responses.`;
  }

  getEmptyContext() {
    return {
      conversationSummary: '',
      last5Responses: [],
      issueKeywords: [],
      troubleshootingStage: 'initial',
      deviceInfo: null,
      customerContext: {},
      linkedTickets: [],
      lastUpdated: new Date().toISOString(),
      contextConfidence: 0.0,
      needsRefresh: false
    };
  }

  // Feedback integration methods
  async logAIFeedback(messageId, ticketId, feedback, agentRewrite = null) {
    // This would typically save to database
    console.log(`AI Feedback logged: ${messageId} - ${feedback}`);
    
    if (agentRewrite) {
      // Store the agent's improved version for future training
      console.log(`Agent rewrite stored for message ${messageId}: ${agentRewrite}`);
    }
  }

  // Method to get AI statistics and insights
  getAIStats() {
    return {
      totalTicketsHandled: this.ticketContextCache.size,
      averageContextConfidence: 0.85,
      troubleshootingFlowsUsed: this.troubleshootingFlows.size,
      clarityOptimizationsApplied: 0
    };
  }
}

module.exports = new EnhancedAIService(); 