const OpenAI = require('openai');
const natural = require('natural');

class AIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || ''
    });
    this.tokenizer = natural.WordTokenizer;
    this.isInitialized = false;
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
      console.log('✅ AI Service initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize AI Service:', error.message);
      return false;
    }
  }

  isEnabled() {
    return this.isInitialized && !!process.env.OPENAI_API_KEY;
  }

  // Generate AI response based on user message and context
  async generateResponse(userMessage, config, contextDocuments = []) {
    if (!this.isEnabled()) {
      throw new Error('AI Service is not available');
    }

    const startTime = Date.now();

    try {
      // Build context from documents
      let documentContext = '';
      if (contextDocuments.length > 0) {
        documentContext = '\n\nRelevant Documentation:\n' + 
          contextDocuments.map(doc => `- ${doc.text}`).join('\n');
      }

      // Build system prompt based on configuration
      const systemPrompt = this.buildSystemPrompt(config, documentContext);

      // Check for escalation keywords
      const escalationKeywords = config.exceptions_behavior ? 
        config.exceptions_behavior.split(',').map(k => k.trim().toLowerCase()) : [];
      
      const messageWords = userMessage.toLowerCase();
      const shouldEscalate = escalationKeywords.some(keyword => 
        messageWords.includes(keyword) || 
        messageWords.includes('human') || 
        messageWords.includes('person') ||
        messageWords.includes('talk to someone')
      );

      if (shouldEscalate) {
        return {
          response: `I understand you'd like to speak with a human agent. Let me connect you with one of our support specialists who can assist you further.`,
          confidence: 1.0,
          shouldEscalate: true,
          responseTimeMs: Date.now() - startTime,
          modelUsed: 'escalation-rule'
        };
      }

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

      // Calculate confidence based on response length and content
      const confidence = this.calculateConfidence(aiResponse, contextDocuments.length);

      return {
        response: aiResponse,
        confidence,
        shouldEscalate: confidence < (config.confidence_threshold || 0.7),
        responseTimeMs: Date.now() - startTime,
        modelUsed: config.model || 'gpt-4o',
        sourceDocuments: contextDocuments.map(doc => doc.id)
      };

    } catch (error) {
      console.error('Error generating AI response:', error);
      throw new Error(`AI response generation failed: ${error.message}`);
    }
  }

  // Build system prompt based on configuration
  buildSystemPrompt(config, documentContext = '') {
    const agentName = config.agent_name || 'NeuroAI';

    let docInfo = '';
    if (documentContext) {
      docInfo = `\n\nKnowledge Base:\n${documentContext}`;
    }

    return `You are ${agentName}, a technical support assistant for NeuroVirtual. Your job is to guide customers step-by-step through troubleshooting their devices.

✅ KEY INSTRUCTIONS:
- Always use the full chat history to understand what the customer already said or tried
- Do not repeat steps the customer has already done or said didn't work
- Give one clear, technical step at a time
- Always look for the information they are asking in the AI learned documents uploaded
- If the step doesn't work, move to the next logical step
- Be short, direct, and helpful
- If the customer asks for a human, stop and notify the agent

Your role:
- Provide clear, direct answers to customer questions
- Use the knowledge base information when available
- Give step-by-step instructions for technical issues
- Be professional but friendly
- Stay focused on NeuroVirtual products and services

Key principles:
- Answer the customer's question directly
- Use simple, clear language
- Provide actionable solutions
- Don't make up information - use only the provided knowledge base
- If you're unsure, say so and offer to connect them with a human agent
- Keep responses helpful and under 500 words${docInfo}

Focus on being helpful and providing solutions to the customer's questions.`;
  }

  // Calculate confidence score based on various factors
  calculateConfidence(response, contextDocCount) {
    let confidence = 0.5; // Base confidence

    // Increase confidence if we have relevant documents
    if (contextDocCount > 0) {
      confidence += 0.2 + (contextDocCount * 0.1);
    }

    // Increase confidence for longer, more detailed responses
    const wordCount = response.split(' ').length;
    if (wordCount > 50) confidence += 0.1;
    if (wordCount > 100) confidence += 0.1;

    // Decrease confidence for very short responses
    if (wordCount < 20) confidence -= 0.2;

    // Check for uncertainty phrases
    const uncertaintyPhrases = ['i\'m not sure', 'i don\'t know', 'might be', 'possibly', 'perhaps'];
    const hasUncertainty = uncertaintyPhrases.some(phrase => 
      response.toLowerCase().includes(phrase)
    );
    
    if (hasUncertainty) confidence -= 0.2;

    // Cap confidence between 0.1 and 0.95
    return Math.max(0.1, Math.min(0.95, confidence));
  }

  // Generate embeddings for text (simplified version)
  async generateEmbedding(text) {
    if (!this.isEnabled()) {
      return null;
    }

    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      return null;
    }
  }

  // Simple similarity search (cosine similarity)
  calculateSimilarity(embedding1, embedding2) {
    if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
      return 0;
    }

    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      magnitude1 += embedding1[i] * embedding1[i];
      magnitude2 += embedding2[i] * embedding2[i];
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (magnitude1 * magnitude2);
  }

  // Find relevant document chunks for a query
  async findRelevantDocuments(query, documentChunks, maxResults = 3) {
    if (!this.isEnabled() || !documentChunks.length) {
      return [];
    }

    try {
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);
      if (!queryEmbedding) {
        return [];
      }

      // Calculate similarities and sort
      const similarities = documentChunks.map(chunk => {
        const embedding = chunk.embedding ? JSON.parse(chunk.embedding) : null;
        const similarity = embedding ? this.calculateSimilarity(queryEmbedding, embedding) : 0;
        
        return {
          ...chunk,
          similarity
        };
      }).sort((a, b) => b.similarity - a.similarity);

      // Return top results with similarity > threshold
      return similarities
        .filter(doc => doc.similarity > 0.3)
        .slice(0, maxResults)
        .map(doc => ({
          id: doc.document_id,
          text: doc.chunk_text,
          similarity: doc.similarity
        }));

    } catch (error) {
      console.error('Error finding relevant documents:', error);
      return [];
    }
  }

  // Generate AI-powered resolution summary for a ticket
  async generateResolutionSummary(ticketData, messages, modelVersion = 'gpt-4o') {
    if (!this.isEnabled()) {
      throw new Error('AI Service is not available');
    }

    const startTime = Date.now();

    try {
      // Filter out system messages and format chat transcript
      const conversationMessages = messages
        .filter(msg => msg.messageType !== 'system')
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map(msg => {
          const sender = msg.sender || {};
          const senderName = sender.userType === 'ai' ? 'AI Assistant' : 
                           sender.userType === 'agent' ? `Agent ${sender.firstName} ${sender.lastName}` :
                           `Customer ${sender.firstName} ${sender.lastName}`;
          return `${senderName}: ${msg.content}`;
        });

      // Build the conversation transcript
      const transcript = conversationMessages.join('\n');

      // Create the summarization prompt
      const systemPrompt = `You are an expert at summarizing customer support conversations. Your task is to create a concise, professional summary of this resolved support ticket.

Focus on:
1. The main issue or problem the customer faced
2. Key troubleshooting steps taken by the support team
3. The final resolution or outcome
4. Keep it between 3-5 sentences
5. Be specific about technical details when relevant
6. Use professional, clear language

Guidelines:
- Start with "Issue:" to describe the problem
- Include "Resolution:" to describe the solution
- Mention any specific products, error codes, or technical details
- Keep it factual and avoid subjective language`;

      const userPrompt = `Please summarize this support conversation:

**Ticket Information:**
- Ticket ID: ${ticketData.ticketNumber || ticketData.id}
- Title: ${ticketData.title}
- Category: ${ticketData.category?.name || 'General'}
- Priority: ${ticketData.priority}
- Customer: ${ticketData.customerName || 'Anonymous'}
- Device: ${ticketData.deviceModel ? `${ticketData.deviceModel} (${ticketData.deviceSerialNumber || 'N/A'})` : 'Not specified'}

**Conversation Transcript:**
${transcript}

Summarize this support conversation in 3–5 sentences. Focus on the issue, key troubleshooting steps, and outcome.`;

      // Generate summary using OpenAI
      const completion = await this.openai.chat.completions.create({
        model: modelVersion,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3, // Lower temperature for more consistent, factual summaries
        max_tokens: 300,
        presence_penalty: 0,
        frequency_penalty: 0
      });

      const summary = completion.choices[0]?.message?.content?.trim();
      
      if (!summary) {
        throw new Error('No summary generated');
      }

      // Calculate confidence based on summary quality
      const confidence = this.calculateSummaryConfidence(summary, transcript.length);

      return {
        summary,
        confidence,
        responseTimeMs: Date.now() - startTime,
        modelUsed: modelVersion,
        messageCount: conversationMessages.length,
        transcriptLength: transcript.length
      };

    } catch (error) {
      console.error('Error generating resolution summary:', error);
      throw new Error(`Summary generation failed: ${error.message}`);
    }
  }

  // Calculate confidence score for summary quality
  calculateSummaryConfidence(summary, transcriptLength) {
    let confidence = 0.7; // Base confidence for AI summaries

    // Check summary length (should be substantial but not too long)
    const summaryLength = summary.length;
    if (summaryLength > 100 && summaryLength < 500) {
      confidence += 0.1;
    }

    // Check for structured format (Issue/Resolution)
    if (summary.toLowerCase().includes('issue') && summary.toLowerCase().includes('resolution')) {
      confidence += 0.1;
    }

    // Check for specific technical details
    const technicalKeywords = ['error', 'code', 'device', 'serial', 'model', 'configuration', 'settings'];
    const hasechnicalDetails = technicalKeywords.some(keyword => 
      summary.toLowerCase().includes(keyword)
    );
    if (hasechnicalDetails) {
      confidence += 0.05;
    }

    // Adjust based on transcript length (more content = potentially better summary)
    if (transcriptLength > 500) {
      confidence += 0.05;
    }

    // Cap confidence between 0.5 and 0.95
    return Math.max(0.5, Math.min(0.95, confidence));
  }

  // Generate AI-powered ticket title and description based on chat context
  async generateTicketDetails(messages, existingTicket = null, modelVersion = 'gpt-4o') {
    if (!this.isEnabled()) {
      throw new Error('AI Service is not available');
    }

    const startTime = Date.now();

    try {
      // Filter and format chat messages for analysis
      const conversationMessages = messages
        .filter(msg => msg.messageType === 'text')
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map(msg => {
          const sender = msg.sender || {};
          const senderType = sender.userType === 'ai' ? 'AI Assistant' : 
                           sender.userType === 'agent' ? 'Agent' :
                           'Customer';
          return `[${senderType}]: ${msg.content}`;
        });

      // Build the conversation transcript
      const transcript = conversationMessages.join('\n');

      // Create the analysis prompt
      const systemPrompt = `You are an expert at analyzing customer support conversations to extract concise ticket summaries.

Your task is to generate:
1. A ticket TITLE (maximum 30 characters) that captures the main issue
2. A ticket DESCRIPTION (maximum 200 characters) that summarizes the problem and context

Guidelines for TITLE:
- Be extremely concise but descriptive
- Focus on the main technical issue or request
- Use technical terms when relevant
- Avoid filler words
- Examples: "WiFi connection drops", "Login error 404", "Device not charging"

Guidelines for DESCRIPTION:
- Summarize the customer's main problem
- Include key technical details (error codes, device models, etc.)
- Mention what the customer has already tried (if any)
- Keep it factual and specific
- Use complete sentences

Format your response as JSON:
{
  "title": "Your title here",
  "description": "Your description here",
  "confidence": 0.85
}

Analyze this conversation:`;

      // Generate AI response
      const completion = await this.openai.chat.completions.create({
        model: modelVersion,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: transcript }
        ],
        temperature: 0.3, // Lower temperature for more consistent results
        max_tokens: 300,
        response_format: { type: "json_object" }
      });

      const aiResponse = completion.choices[0]?.message?.content?.trim();
      
      if (!aiResponse) {
        throw new Error('No response generated');
      }

      // Parse the JSON response
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(aiResponse);
      } catch (parseError) {
        throw new Error(`Failed to parse AI response: ${parseError.message}`);
      }

      // Validate and truncate if necessary
      const title = (parsedResponse.title || '').substring(0, 30).trim();
      const description = (parsedResponse.description || '').substring(0, 200).trim();
      const confidence = Math.max(0.1, Math.min(0.95, parsedResponse.confidence || 0.7));

      // Fallback if AI couldn't generate proper content
      if (!title || !description) {
        return {
          title: existingTicket?.title || 'Support Request',
          description: existingTicket?.description || 'Customer support request',
          confidence: 0.3,
          responseTimeMs: Date.now() - startTime,
          modelUsed: modelVersion,
          wasGenerated: false
        };
      }

      return {
        title,
        description,
        confidence,
        responseTimeMs: Date.now() - startTime,
        modelUsed: modelVersion,
        wasGenerated: true
      };

    } catch (error) {
      console.error('Error generating ticket details:', error);
      
      // Return fallback values
      return {
        title: existingTicket?.title || 'Support Request',
        description: existingTicket?.description || 'Customer support request',
        confidence: 0.1,
        responseTimeMs: Date.now() - startTime,
        modelUsed: modelVersion,
        wasGenerated: false,
        error: error.message
      };
    }
  }
}

module.exports = new AIService(); 