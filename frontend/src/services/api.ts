import { User, Ticket, Message, Category } from '../types';

// Removed unused ApiResponse interface

class ApiService {
  private baseURL = 'http://localhost:3001/api';
  private token: string | null = null;

  constructor() {
    // Load token from localStorage on initialization
    const savedToken = localStorage.getItem('auth_token');
    if (savedToken) {
      this.setToken(savedToken);
    }
  }

  private async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    
    console.log('API: Making request to:', `${this.baseURL}${url}`);
    console.log('API: Request method:', options.method || 'GET');
    console.log('API: Has token:', !!this.token);
    
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
      console.log('API: Authorization header set with token');
    } else {
      console.warn('API: No token available for authenticated request');
    }

    const response = await fetch(`${this.baseURL}${url}`, {
      ...options,
      headers,
    });

    console.log('API: Response received, status:', response.status);

    // Handle 401 errors by logging out (but not during login requests)
    if (response.status === 401 && !url.includes('/auth/login')) {
      console.error('API: Authentication failed, logging out');
      this.logout();
      throw new Error('Authentication failed');
    }

    return response;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    console.log('API Response status:', response.status);
    console.log('API Response headers:', response.headers);
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP error! status: ${response.status}`;
      
      console.error('API Error - Status:', response.status, 'Response:', errorText);
      
      try {
        const errorData = JSON.parse(errorText);
        console.error('Parsed error data:', errorData);
        errorMessage = errorData.error?.message || errorData.message || errorMessage;
      } catch {
        // If not JSON, use the text as error message
        errorMessage = errorText || errorMessage;
      }
      
      throw new Error(errorMessage);
    }

    const text = await response.text();
    console.log('API Response text:', text);
    
    if (!text) return {} as T;
    
    try {
      const parsed = JSON.parse(text);
      console.log('API Parsed response:', parsed);
      return parsed;
    } catch (parseError) {
      console.error('Failed to parse JSON response:', text);
      console.error('Parse error:', parseError);
      throw new Error('Invalid JSON response');
    }
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  logout() {
    this.token = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    // Don't redirect here - let the app handle routing
  }

  // Auth APIs
  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    console.log('API: Sending login request to', `${this.baseURL}/auth/login`);
    
    const response = await this.fetchWithAuth('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    console.log('API: Login response status:', response.status);
    
    const apiResponse = await this.handleResponse<{
      success: boolean;
      data: {
        user: {
          id: string;
          email: string;
          firstName: string;
          lastName: string;
          userType: 'customer' | 'agent';
          agentStatus?: string;
          roleId?: string;
          roleName?: string;
          permissions?: string[];
        };
        tokens: {
          accessToken: string;
          expiresIn: number;
        };
      };
    }>(response);
    
    console.log('API: Login successful, received data:', apiResponse);
    
    // Transform the response to match frontend expectations
    const user: User = {
      id: apiResponse.data.user.id,
      email: apiResponse.data.user.email,
      name: `${apiResponse.data.user.firstName} ${apiResponse.data.user.lastName}`,
      firstName: apiResponse.data.user.firstName,
      lastName: apiResponse.data.user.lastName,
      role: apiResponse.data.user.userType,
      userType: apiResponse.data.user.userType,
      agentStatus: apiResponse.data.user.agentStatus as 'online' | 'busy' | 'offline' | undefined,
      roleId: apiResponse.data.user.roleId,
      roleName: apiResponse.data.user.roleName,
      permissions: apiResponse.data.user.permissions || [],
    };
    
    const token = apiResponse.data.tokens.accessToken;
    
    this.setToken(token);
    localStorage.setItem('user_data', JSON.stringify(user));
    
    return { user, token };
  }

  async register(name: string, email: string, password: string): Promise<{ user: User; token: string }> {
    const response = await this.fetchWithAuth('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    
    const data = await this.handleResponse<{ user: User; token: string }>(response);
    this.setToken(data.token);
    localStorage.setItem('user_data', JSON.stringify(data.user));
    return data;
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.fetchWithAuth('/auth/me');
    const data = await this.handleResponse<{ user: User }>(response);
    return data.user;
  }

  // Ticket APIs
  async getTickets(filters?: { status?: string; priority?: string; category?: string; search?: string }): Promise<Ticket[]> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }
    
    const queryString = params.toString();
    const url = `/tickets${queryString ? `?${queryString}` : ''}`;
    
    const response = await this.fetchWithAuth(url);
    const apiResponse = await this.handleResponse<{ success: boolean; data: { tickets: any[] } }>(response);
    
    // Transform tickets to match frontend interface
    const tickets: Ticket[] = apiResponse.data.tickets.map((ticket: any) => {
      console.log(`🎫 Processing ticket ${ticket.id}:`, {
        hasMessages: !!ticket.messages,
        messageCount: ticket.messages?.length || 0,
        rawMessages: ticket.messages
      });
      
      return {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber || ticket.id,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category?.name || ticket.categoryId,
        customerId: ticket.customerId,
        customerName: ticket.customerName,
        customerEmail: ticket.customerEmail,
        customerPhone: ticket.customerPhone,
        customerCompany: ticket.customerCompany,
        customerAddress: ticket.customerAddress,
        customerStreetAddress: ticket.customerStreetAddress,
        customerCity: ticket.customerCity,
        customerState: ticket.customerState,
        customerZipCode: ticket.customerZipCode,
        customerCountry: ticket.customerCountry,
        customerType: ticket.customerType || 'Standard',
        deviceModel: ticket.deviceModel,
        deviceSerialNumber: ticket.deviceSerialNumber,
        agentId: ticket.agentId,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        customer: ticket.customer ? {
          id: ticket.customer.id,
          email: ticket.customer.email,
          name: `${ticket.customer.firstName} ${ticket.customer.lastName}`,
          role: 'customer' as const
        } : undefined,
        agent: ticket.agent ? {
          id: ticket.agent.id,
          email: ticket.agent.email,
          name: `${ticket.agent.firstName} ${ticket.agent.lastName}`,
          role: 'agent' as const
        } : undefined,
        messages: ticket.messages ? ticket.messages.map((msg: any) => ({
          id: msg.id,
          ticketId: msg.ticketId,
          senderId: msg.senderId,
          content: msg.content,
          messageType: msg.messageType || 'text',
          createdAt: msg.createdAt,
          sender: msg.sender ? {
            id: msg.sender.id,
            firstName: msg.sender.firstName,
            lastName: msg.sender.lastName,
            userType: msg.sender.userType
          } : undefined
        })) : []
      };
    });
    
    return tickets;
  }

  async getTicketById(id: string): Promise<Ticket> {
    const response = await this.fetchWithAuth(`/tickets/${id}`);
    const data = await this.handleResponse<{ ticket: Ticket }>(response);
    return data.ticket;
  }

  async createTicket(ticketData: any, customerInfo?: { name: string; email: string; company?: string; phone?: string; country?: string }): Promise<Ticket> {
    console.log('API: Creating ticket with data:', ticketData);
    console.log('API: Customer info:', customerInfo);
    
    const payload = {
      ...ticketData,
      ...(customerInfo && { customerInfo })
    };
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseURL}/tickets`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    
    console.log('API: Create ticket response status:', response.status);
    
    const apiResponse = await this.handleResponse<{
      success: boolean;
      data: {
        ticket: {
          id: string;
          ticketNumber: string;
          title: string;
          description: string;
          status: string;
          priority: string;
          categoryId: string;
          customerId: string | null;
          customerName: string;
          customerEmail: string;
          customerPhone: string | null;
          customerCompany: string | null;
          customerAddress: string | null;
          agentId: string | null;
          createdAt: string;
          updatedAt: string;
          isAnonymous: boolean;
          customer: {
            id?: string;
            firstName?: string;
            lastName?: string;
            name?: string;
            email?: string;
            company?: string;
          };
          category: {
            id: string;
            name: string;
            description: string;
          };
        };
      };
    }>(response);
    
    console.log('API: Create ticket successful, received data:', apiResponse);
    
    // Transform the response to match frontend expectations
    const createdTicket: Ticket = {
      id: apiResponse.data.ticket.id,
      ticketNumber: apiResponse.data.ticket.ticketNumber || apiResponse.data.ticket.id,
      title: apiResponse.data.ticket.title,
      description: apiResponse.data.ticket.description,
      status: apiResponse.data.ticket.status as 'new' | 'in_progress' | 'resolved',
      priority: apiResponse.data.ticket.priority as 'low' | 'medium' | 'high',
      category: apiResponse.data.ticket.category.name,
      customerId: apiResponse.data.ticket.customerId || '',
      customerName: apiResponse.data.ticket.customerName,
      customerEmail: apiResponse.data.ticket.customerEmail,
      customerPhone: apiResponse.data.ticket.customerPhone || undefined,
      customerCompany: apiResponse.data.ticket.customerCompany || undefined,
      customerAddress: apiResponse.data.ticket.customerAddress || undefined,
      customerStreetAddress: (apiResponse.data.ticket as any).customerStreetAddress || undefined,
      customerCity: (apiResponse.data.ticket as any).customerCity || undefined,
      customerState: (apiResponse.data.ticket as any).customerState || undefined,
      customerZipCode: (apiResponse.data.ticket as any).customerZipCode || undefined,
      customerCountry: (apiResponse.data.ticket as any).customerCountry || undefined,
      customerType: (apiResponse.data.ticket as any).customerType || 'Standard',
      deviceModel: (apiResponse.data.ticket as any).deviceModel || undefined,
      deviceSerialNumber: (apiResponse.data.ticket as any).deviceSerialNumber || undefined,
      agentId: apiResponse.data.ticket.agentId || undefined,
      createdAt: apiResponse.data.ticket.createdAt,
      updatedAt: apiResponse.data.ticket.updatedAt,
      customer: apiResponse.data.ticket.customer.id ? {
        id: apiResponse.data.ticket.customer.id,
        email: apiResponse.data.ticket.customerEmail,
        name: `${apiResponse.data.ticket.customer.firstName} ${apiResponse.data.ticket.customer.lastName}`,
        role: 'customer' as const
      } : {
        id: '',
        email: apiResponse.data.ticket.customerEmail,
        name: apiResponse.data.ticket.customerName,
        role: 'customer' as const
      }
    };
    
    return createdTicket;
  }

  async updateTicket(id: string, updates: Partial<Ticket>): Promise<Ticket> {
    console.log('🔧 API: updateTicket called');
    console.log('  - ticketId:', id);
    console.log('  - updates:', updates);
    console.log('  - updates.customerAddress:', updates.customerAddress);
    console.log('  - updates.customerCity:', updates.customerCity);
    console.log('  - customerAddress included:', 'customerAddress' in updates);
    console.log('  - customerCity included:', 'customerCity' in updates);
    
    const response = await this.fetchWithAuth(`/tickets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    
    console.log('🔧 API: updateTicket response status:', response.status);
    
    const apiResponse = await this.handleResponse<{ success: boolean; data: { ticket: any } }>(response);
    
    console.log('🔧 API: updateTicket response data:', apiResponse);
    console.log('  - response ticket.customerAddress:', apiResponse.data.ticket.customerAddress);
    
    // Transform the ticket data to match frontend interface
    const ticket: Ticket = {
      id: apiResponse.data.ticket.id,
      ticketNumber: apiResponse.data.ticket.ticketNumber || apiResponse.data.ticket.id,
      title: apiResponse.data.ticket.title,
      description: apiResponse.data.ticket.description,
      status: apiResponse.data.ticket.status,
      priority: apiResponse.data.ticket.priority,
      category: apiResponse.data.ticket.category?.name || apiResponse.data.ticket.categoryId,
      customerId: apiResponse.data.ticket.customerId,
      customerName: apiResponse.data.ticket.customerName,
      customerEmail: apiResponse.data.ticket.customerEmail,
      customerPhone: apiResponse.data.ticket.customerPhone,
      customerCompany: apiResponse.data.ticket.customerCompany,
      customerAddress: apiResponse.data.ticket.customerAddress,
      customerStreetAddress: (apiResponse.data.ticket as any).customerStreetAddress,
      customerCity: (apiResponse.data.ticket as any).customerCity,
      customerState: (apiResponse.data.ticket as any).customerState,
      customerZipCode: (apiResponse.data.ticket as any).customerZipCode,
      customerCountry: (apiResponse.data.ticket as any).customerCountry,
      customerType: (apiResponse.data.ticket as any).customerType || 'Standard', // Add customerType with default
      deviceModel: (apiResponse.data.ticket as any).deviceModel,
      deviceSerialNumber: (apiResponse.data.ticket as any).deviceSerialNumber,
      agentId: apiResponse.data.ticket.agentId,
      createdAt: apiResponse.data.ticket.createdAt,
      updatedAt: apiResponse.data.ticket.updatedAt,
      customer: apiResponse.data.ticket.customer ? {
        id: apiResponse.data.ticket.customer.id,
        email: apiResponse.data.ticket.customer.email,
        name: `${apiResponse.data.ticket.customer.firstName} ${apiResponse.data.ticket.customer.lastName}`,
        role: 'customer' as const
      } : undefined,
      agent: apiResponse.data.ticket.agent ? {
        id: apiResponse.data.ticket.agent.id,
        email: apiResponse.data.ticket.agent.email,
        name: `${apiResponse.data.ticket.agent.firstName} ${apiResponse.data.ticket.agent.lastName}`,
        role: 'agent' as const
      } : undefined,
    };
    
    console.log('🔧 API: transformed ticket:', ticket);
    console.log('  - transformed ticket.customerAddress:', ticket.customerAddress);
    
    return ticket;
  }

  async claimTicket(id: string): Promise<Ticket> {
    const response = await this.fetchWithAuth(`/tickets/${id}/claim`, {
      method: 'POST',
    });
    
    const data = await this.handleResponse<{ ticket: Ticket }>(response);
    return data.ticket;
  }

  async rateTicket(id: string, rating: number, feedback?: string): Promise<void> {
    await this.fetchWithAuth(`/tickets/${id}/rate`, {
      method: 'POST',
      body: JSON.stringify({ rating, feedback }),
    });
  }

  async deleteTicket(id: string): Promise<void> {
    const response = await this.fetchWithAuth(`/tickets/${id}`, {
      method: 'DELETE',
    });
    await this.handleResponse<void>(response);
  }

  // Internal Comments APIs
  async getInternalComments(ticketId: string): Promise<any[]> {
    console.log('API: Getting internal comments for ticket', ticketId);
    const response = await this.fetchWithAuth(`/tickets/${ticketId}/internal-comments`);
    console.log('API: Get internal comments response status:', response.status);
    const data = await this.handleResponse<{ success: boolean; data: { comments: any[] } }>(response);
    console.log('API: Get internal comments successful, received data:', data);
    return data.data.comments;
  }

  async addInternalComment(ticketId: string, content: string): Promise<any> {
    console.log('API: Adding internal comment to ticket', ticketId, 'content:', content);
    const response = await this.fetchWithAuth(`/tickets/${ticketId}/internal-comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
    console.log('API: Add internal comment response status:', response.status);
    const data = await this.handleResponse<{ success: boolean; data: { comment: any } }>(response);
    console.log('API: Add internal comment successful, received data:', data);
    return data.data.comment;
  }

  // Message APIs
  async getMessages(ticketId: string): Promise<Message[]> {
    console.log('API: Getting messages for ticket', ticketId);
    
    const response = await this.fetchWithAuth(`/tickets/${ticketId}/messages`);
    
    console.log('API: Get messages response status:', response.status);
    
    const apiResponse = await this.handleResponse<{
      success: boolean;
      data: {
        messages: any[];
      };
    }>(response);
    
    console.log('API: Get messages successful, received data:', apiResponse);
    
    // Transform messages to match frontend interface
    const messages: Message[] = (apiResponse.data.messages || []).map((msg: any) => ({
      id: msg.id,
      content: msg.content,
      messageType: msg.messageType || 'text',
      userId: msg.senderId,
      ticketId: msg.ticketId,
      createdAt: msg.createdAt,
      user: msg.sender ? {
        id: msg.sender.id,
        email: msg.sender.email || '',
        name: `${msg.sender.firstName} ${msg.sender.lastName}`,
        role: msg.sender.userType as 'customer' | 'agent'
      } : undefined
    }));
    
    return messages;
  }

  async sendMessage(ticketId: string, content: string): Promise<Message> {
    console.log('API: Sending message to ticket', ticketId, 'content:', content);
    
    const response = await this.fetchWithAuth(`/tickets/${ticketId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
    
    console.log('API: Send message response status:', response.status);
    
    const apiResponse = await this.handleResponse<{
      success: boolean;
      data: {
        message: any;
      };
    }>(response);
    
    console.log('API: Send message successful, received data:', apiResponse);
    
    // Transform message to match frontend interface
    const message: Message = {
      id: apiResponse.data.message.id,
      content: apiResponse.data.message.content,
      messageType: apiResponse.data.message.messageType || 'text',
      userId: apiResponse.data.message.senderId,
      ticketId: apiResponse.data.message.ticketId,
      createdAt: apiResponse.data.message.createdAt,
      user: apiResponse.data.message.sender ? {
        id: apiResponse.data.message.sender.id,
        email: apiResponse.data.message.sender.email || '',
        name: `${apiResponse.data.message.sender.firstName} ${apiResponse.data.message.sender.lastName}`,
        role: apiResponse.data.message.sender.userType as 'customer' | 'agent'
      } : undefined
    };
    
    return message;
  }

  async uploadFile(ticketId: string, file: File): Promise<{ message: Message; file: any }> {
    console.log('API: Uploading file to ticket', ticketId, 'file:', file.name);
    console.log('API: File size:', file.size, 'bytes');
    console.log('API: File type:', file.type);
    console.log('API: Has token:', !!this.token);
    
    const formData = new FormData();
    formData.append('file', file);

    // Use fetch directly for file upload (no JSON Content-Type header)
    const response = await fetch(`${this.baseURL}/tickets/${ticketId}/upload`, {
      method: 'POST',
      headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {},
      body: formData,
    });

    console.log('API: Upload file response status:', response.status);
    console.log('API: Upload file response headers:', response.headers);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('API: Upload file error response text:', errorText);
      let errorMessage = `HTTP error! status: ${response.status}`;
      
      try {
        const errorData = JSON.parse(errorText);
        console.log('API: Upload file parsed error data:', errorData);
        errorMessage = errorData.error?.message || errorData.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      
      console.log('API: Upload file final error message:', errorMessage);
      throw new Error(errorMessage);
    }

    const apiResponse = await response.json();
    console.log('API: Upload file successful, received data:', apiResponse);
    
    // Transform message to match frontend interface
    const message: Message = {
      id: apiResponse.data.message.id,
      content: apiResponse.data.message.content,
      messageType: apiResponse.data.message.messageType,
      userId: apiResponse.data.message.senderId,
      ticketId: apiResponse.data.message.ticketId,
      createdAt: apiResponse.data.message.createdAt,
      user: apiResponse.data.message.sender ? {
        id: apiResponse.data.message.sender.id,
        email: apiResponse.data.message.sender.email || '',
        name: `${apiResponse.data.message.sender.firstName} ${apiResponse.data.message.sender.lastName}`,
        role: apiResponse.data.message.sender.userType as 'customer' | 'agent'
      } : undefined,
      fileName: apiResponse.data.message.fileName,
      filePath: apiResponse.data.message.filePath,
      fileSize: apiResponse.data.message.fileSize,
      fileUrl: apiResponse.data.message.fileUrl
    };
    
    return {
      message,
      file: apiResponse.data.file
    };
  }

  async getTicketFiles(ticketId: string): Promise<any[]> {
    console.log('📁 API: Getting files for ticket:', ticketId);
    console.log('📁 API: Current auth token:', localStorage.getItem('auth_token') ? 'Present' : 'Missing');
    console.log('📁 API: Full URL:', `${this.baseURL}/tickets/${ticketId}/files`);
    console.log('📁 API: Base URL:', this.baseURL);
    console.log('📁 API: Request path:', `/tickets/${ticketId}/files`);
    
    try {
      const response = await this.fetchWithAuth(`/tickets/${ticketId}/files`);
      console.log('📁 API: Response status:', response.status);
      console.log('📁 API: Response headers:', Object.fromEntries(response.headers.entries()));
      
      const result = await this.handleResponse<{ success: boolean; data: { files: any[] } }>(response);
      
      console.log('📁 API: Retrieved files result:', result);
      console.log('📁 API: Files array:', result.data.files);
      console.log('📁 API: Files count:', result.data.files.length);
      return result.data.files;
      
    } catch (error) {
      console.error('📁 API: Error getting files:', error);
      console.error('📁 API: Error details:', {
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack
      });
      throw error;
    }
  }

  // Categories API
  async getCategories(): Promise<Category[]> {
    const response = await this.fetchWithAuth('/categories');
    const apiResponse = await this.handleResponse<{ success: boolean; data: { categories: any[] } }>(response);
    
    // Transform categories to match frontend interface
    const categories: Category[] = apiResponse.data.categories.map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description
    }));
    
    return categories;
  }

  async createCategory(categoryData: { name: string; description: string; colorCode?: string }): Promise<Category> {
    const response = await this.fetchWithAuth('/categories', {
      method: 'POST',
      body: JSON.stringify(categoryData)
    });
    const apiResponse = await this.handleResponse<{ success: boolean; data: { category: any } }>(response);
    
    return {
      id: apiResponse.data.category.id,
      name: apiResponse.data.category.name,
      description: apiResponse.data.category.description
    };
  }

  async updateCategory(id: string, categoryData: { name?: string; description?: string; colorCode?: string }): Promise<Category> {
    const response = await this.fetchWithAuth(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(categoryData)
    });
    const apiResponse = await this.handleResponse<{ success: boolean; data: { category: any } }>(response);
    
    return {
      id: apiResponse.data.category.id,
      name: apiResponse.data.category.name,
      description: apiResponse.data.category.description
    };
  }

  async deleteCategory(id: string): Promise<void> {
    const response = await this.fetchWithAuth(`/categories/${id}`, {
      method: 'DELETE'
    });
    await this.handleResponse<{ success: boolean; message: string }>(response);
  }

  // System Settings API (Admin only)
  async getSystemSettings(): Promise<any> {
    const response = await this.fetchWithAuth('/system-settings');
    const apiResponse = await this.handleResponse<{ success: boolean; data: { settings: any } }>(response);
    return apiResponse.data.settings;
  }

  async updateSystemSettings(settings: any): Promise<any> {
    const response = await this.fetchWithAuth('/system-settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
    const apiResponse = await this.handleResponse<{ success: boolean; data: { settings: any } }>(response);
    return apiResponse.data.settings;
  }

  // Get public system settings for components
  async getPublicSystemSettings(): Promise<any> {
    const response = await this.fetchWithAuth('/system-settings/public');
    const apiResponse = await this.handleResponse<{ success: boolean; data: { settings: any } }>(response);
    return apiResponse.data.settings;
  }

  // Dropdown Options Management APIs
  async getDropdownOptions(): Promise<{
    categories: Category[];
    deviceModels: any[];
    customerTypes: any[];
  }> {
    try {
      // Try the combined endpoint first (requires Admin role)
      const response = await this.fetchWithAuth('/dropdown-options');
      const data = await this.handleResponse<{ 
        success: boolean; 
        data: {
          categories: Category[];
          deviceModels: any[];
          customerTypes: any[];
        }
      }>(response);
      return data.data;
    } catch (error) {
      console.log('Combined dropdown-options endpoint failed, falling back to individual endpoints:', (error as Error).message);
      
      // Fallback: Get data from individual endpoints
      try {
        const [categoriesData, deviceModelsData, customerTypesData] = await Promise.all([
          this.getCategories(),
          this.getDeviceModelsDirect(),
          this.getCustomerTypesDirect()
        ]);
        
        return {
          categories: categoriesData,
          deviceModels: deviceModelsData,
          customerTypes: customerTypesData
        };
      } catch (fallbackError) {
        console.error('All dropdown options endpoints failed:', fallbackError);
        throw new Error(`Failed to load dropdown options: ${(fallbackError as Error).message}`);
      }
    }
  }

  // Device Models APIs
  async getDeviceModels(): Promise<any[]> {
    return this.getDeviceModelsDirect();
  }

  private async getDeviceModelsDirect(): Promise<any[]> {
    const response = await this.fetchWithAuth('/device-models');
    const data = await this.handleResponse<{ success: boolean; data: { deviceModels: any[] } }>(response);
    return data.data.deviceModels;
  }

  async createDeviceModel(modelData: { 
    name: string; 
    description?: string; 
    isActive?: boolean; 
    displayOrder?: number 
  }): Promise<any> {
    const response = await this.fetchWithAuth('/device-models', {
      method: 'POST',
      body: JSON.stringify(modelData),
    });
    const data = await this.handleResponse<{ success: boolean; data: { deviceModel: any } }>(response);
    return data.data.deviceModel;
  }

  async updateDeviceModel(id: string, modelData: { 
    name?: string; 
    description?: string; 
    isActive?: boolean; 
    displayOrder?: number 
  }): Promise<any> {
    const response = await this.fetchWithAuth(`/device-models/${id}`, {
      method: 'PUT',
      body: JSON.stringify(modelData),
    });
    const data = await this.handleResponse<{ success: boolean; data: { deviceModel: any } }>(response);
    return data.data.deviceModel;
  }

  async deleteDeviceModel(id: string): Promise<void> {
    const response = await this.fetchWithAuth(`/device-models/${id}`, {
      method: 'DELETE',
    });
    await this.handleResponse<{ success: boolean; message: string }>(response);
  }

  // Customer Types APIs
  async getCustomerTypes(): Promise<any[]> {
    return this.getCustomerTypesDirect();
  }

  private async getCustomerTypesDirect(): Promise<any[]> {
    const response = await this.fetchWithAuth('/customer-types');
    const data = await this.handleResponse<{ success: boolean; data: { customerTypes: any[] } }>(response);
    return data.data.customerTypes;
  }

  async createCustomerType(typeData: { 
    name: string; 
    description?: string; 
    colorCode?: string; 
    isActive?: boolean; 
    displayOrder?: number 
  }): Promise<any> {
    const response = await this.fetchWithAuth('/customer-types', {
      method: 'POST',
      body: JSON.stringify(typeData),
    });
    const data = await this.handleResponse<{ success: boolean; data: { customerType: any } }>(response);
    return data.data.customerType;
  }

  async updateCustomerType(id: string, typeData: { 
    name?: string; 
    description?: string; 
    colorCode?: string; 
    isActive?: boolean; 
    displayOrder?: number 
  }): Promise<any> {
    const response = await this.fetchWithAuth(`/customer-types/${id}`, {
      method: 'PUT',
      body: JSON.stringify(typeData),
    });
    const data = await this.handleResponse<{ success: boolean; data: { customerType: any } }>(response);
    return data.data.customerType;
  }

  async deleteCustomerType(id: string): Promise<void> {
    const response = await this.fetchWithAuth(`/customer-types/${id}`, {
      method: 'DELETE',
    });
    await this.handleResponse<{ success: boolean; message: string }>(response);
  }

  // User APIs (for agents)
  async getUsers(): Promise<User[]> {
    const response = await this.fetchWithAuth('/users');
    const data = await this.handleResponse<{ users: User[] }>(response);
    return data.users;
  }

  async getAgents(): Promise<User[]> {
    console.log('🔍 API: getAgents called');
    const response = await this.fetchWithAuth('/agents');
    console.log('🔍 API: getAgents response status:', response.status);
    
    const apiResponse = await this.handleResponse<{ success: boolean; data: { agents: any[] } }>(response);
    console.log('🔍 API: getAgents parsed response:', apiResponse);
    
    // Transform agents to match frontend interface with presence information
    const agents: User[] = apiResponse.data.agents.map((agent: any) => ({
      id: agent.id,
      email: agent.email,
      name: agent.name || `${agent.firstName} ${agent.lastName}`,
      role: 'agent' as const,
      roleName: agent.roleName || 'Tier1',
      firstName: agent.firstName,
      lastName: agent.lastName,
      isOnline: agent.isOnline || false, // Include real-time online status
      lastSeen: agent.lastSeen || agent.lastLogin, // Include last seen time
    }));
    
    console.log('🔍 API: getAgents transformed agents with presence:', agents);
    return agents;
  }

  async reassignTicket(ticketId: string, agentId: string): Promise<Ticket> {
    const response = await this.fetchWithAuth(`/tickets/${ticketId}`, {
      method: 'PUT',
      body: JSON.stringify({ agentId: agentId || null }),
    });
    
    const apiResponse = await this.handleResponse<{ success: boolean; data: { ticket: any } }>(response);
    
    // Transform ticket to match frontend interface
    const ticket: Ticket = {
      id: apiResponse.data.ticket.id,
      ticketNumber: apiResponse.data.ticket.ticketNumber || apiResponse.data.ticket.id,
      title: apiResponse.data.ticket.title,
      description: apiResponse.data.ticket.description,
      status: apiResponse.data.ticket.status,
      priority: apiResponse.data.ticket.priority,
      category: apiResponse.data.ticket.category?.name || apiResponse.data.ticket.categoryId,
      customerId: apiResponse.data.ticket.customerId,
      agentId: apiResponse.data.ticket.agentId,
      createdAt: apiResponse.data.ticket.createdAt,
      updatedAt: apiResponse.data.ticket.updatedAt,
      customer: apiResponse.data.ticket.customer ? {
        id: apiResponse.data.ticket.customer.id,
        email: apiResponse.data.ticket.customer.email,
        name: `${apiResponse.data.ticket.customer.firstName} ${apiResponse.data.ticket.customer.lastName}`,
        role: 'customer' as const
      } : undefined,
      agent: apiResponse.data.ticket.agent ? {
        id: apiResponse.data.ticket.agent.id,
        email: apiResponse.data.ticket.agent.email,
        name: `${apiResponse.data.ticket.agent.firstName} ${apiResponse.data.ticket.agent.lastName}`,
        role: 'agent' as const
      } : undefined,
    };
    
    return ticket;
  }

  // Get customer status for a ticket
  async getCustomerStatus(ticketId: string): Promise<{ isOnline: boolean; lastSeen: string | null; customerId: string | null }> {
    const response = await this.fetchWithAuth(`/tickets/${ticketId}/customer-status`);
    const apiResponse = await this.handleResponse<{ success: boolean; data: any }>(response);
    
    // Handle nested customerStatus structure from backend
    const statusData = apiResponse.data.customerStatus || apiResponse.data;
    
    return {
      isOnline: statusData.isOnline || false,
      lastSeen: statusData.lastSeen || null,
      customerId: statusData.customerId || null
    };
  }

  // Close ticket (for customers - no authentication required)
  async closeTicket(ticketId: string): Promise<void> {
    const response = await fetch(`${this.baseURL}/tickets/${ticketId}/close`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    await this.handleResponse<{ success: boolean; data: { message: string } }>(response);
  }

  // Submit feedback without closing ticket (for customers - no authentication required)
  async submitTicketFeedback(ticketId: string, resolution: 'resolved' | 'not_resolved' | 'partially_resolved'): Promise<void> {
    console.log('🔧 DEBUG: submitTicketFeedback called with:', { ticketId, resolution });
    console.log('🔧 DEBUG: API URL will be:', `${this.baseURL}/tickets/${ticketId}/feedback`);
    console.log('🔧 DEBUG: Request body will be:', JSON.stringify({ resolution }));
    
    try {
      const response = await fetch(`${this.baseURL}/tickets/${ticketId}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resolution }),
      });
      
      console.log('🔧 DEBUG: submitTicketFeedback response status:', response.status);
      console.log('🔧 DEBUG: submitTicketFeedback response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔧 DEBUG: submitTicketFeedback error response:', errorText);
        console.error('🔧 DEBUG: Response status:', response.status);
        console.error('🔧 DEBUG: Response statusText:', response.statusText);
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }
      
      const responseData = await response.json();
      console.log('🔧 DEBUG: submitTicketFeedback response data:', responseData);
      console.log('🔧 DEBUG: submitTicketFeedback completed successfully');
    } catch (error) {
      console.error('🔧 DEBUG: submitTicketFeedback error:', error);
      console.error('🔧 DEBUG: Error type:', typeof error);
      console.error('🔧 DEBUG: Error instanceof Error:', error instanceof Error);
      console.error('🔧 DEBUG: Error name:', error instanceof Error ? error.name : 'unknown');
      console.error('🔧 DEBUG: Error message:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // Close ticket with feedback (for customers - no authentication required)
  async closeTicketWithFeedback(ticketId: string, resolution: 'resolved' | 'not_resolved' | 'partially_resolved'): Promise<void> {
    console.log('🔧 DEBUG: closeTicketWithFeedback called with:', { ticketId, resolution });
    console.log('🔧 DEBUG: API URL will be:', `${this.baseURL}/tickets/${ticketId}/close-with-feedback`);
    
    try {
      const response = await fetch(`${this.baseURL}/tickets/${ticketId}/close-with-feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resolution }),
      });
      
      console.log('🔧 DEBUG: Response status:', response.status);
      console.log('🔧 DEBUG: Response headers:', response.headers);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔧 DEBUG: Error response text:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const responseData = await this.handleResponse<{ success: boolean; data: { message: string } }>(response);
      console.log('🔧 DEBUG: Successful response:', responseData);
    } catch (error) {
      console.error('🔧 DEBUG: closeTicketWithFeedback error:', error);
      throw error;
    }
  }

  // Insights API - Get analytics data
  async getInsights(filters?: {
    timeRange?: 'daily' | 'monthly' | 'quarterly';
    startDate?: string;
    endDate?: string;
    agentId?: string;
    category?: string;
  }): Promise<any> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }
    
    const queryString = params.toString();
    const url = `/insights${queryString ? `?${queryString}` : ''}`;
    
    const response = await this.fetchWithAuth(url);
    const apiResponse = await this.handleResponse<{ success: boolean; data: any }>(response);
    
    return apiResponse.data;
  }

  // Customer APIs
  async getCustomers(filters?: {
    search?: string;
    country?: string;
    customerType?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<any[]> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }
    
    const queryString = params.toString();
    const url = `/customers${queryString ? `?${queryString}` : ''}`;
    
    const response = await this.fetchWithAuth(url);
    const apiResponse = await this.handleResponse<{ success: boolean; data: { customers: any[] } }>(response);
    
    return apiResponse.data.customers;
  }

  async getCustomer(identifier: string): Promise<any> {
    const response = await this.fetchWithAuth(`/customers/${identifier}`);
    const apiResponse = await this.handleResponse<{ success: boolean; data: { customer: any } }>(response);
    return apiResponse.data.customer;
  }

  async updateCustomer(identifier: string, updates: any): Promise<any> {
    const response = await this.fetchWithAuth(`/customers/${identifier}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    const apiResponse = await this.handleResponse<{ success: boolean; data: { customer: any } }>(response);
    return apiResponse.data.customer;
  }

  async deleteCustomer(identifier: string): Promise<void> {
    await this.fetchWithAuth(`/customers/${identifier}`, {
      method: 'DELETE',
    });
  }

  // Device APIs
  async getDevices(filters?: {
    page?: number;
    limit?: number;
    search?: string;
    model?: string;
    status?: string;
    customerId?: string;
  }): Promise<{ devices: any[]; pagination: any }> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value.toString());
        }
      });
    }
    
    const queryString = params.toString();
    const url = `/devices${queryString ? `?${queryString}` : ''}`;
    
    const response = await this.fetchWithAuth(url);
    const apiResponse = await this.handleResponse<{ success: boolean; data: { devices: any[]; pagination: any } }>(response);
    
    return apiResponse.data;
  }

  async getDevice(id: string): Promise<any> {
    const response = await this.fetchWithAuth(`/devices/${id}`);
    const apiResponse = await this.handleResponse<{ success: boolean; data: { device: any } }>(response);
    return apiResponse.data.device;
  }

  async createDevice(deviceData: {
    customerId: string;
    model: string;
    serialNumber: string;
    warrantyExpires?: string;
    invoiceNumber?: string;
    invoiceDate?: string;
    comments?: string;
  }): Promise<any> {
    const response = await this.fetchWithAuth('/devices', {
      method: 'POST',
      body: JSON.stringify(deviceData),
    });
    const apiResponse = await this.handleResponse<{ success: boolean; data: { device: any } }>(response);
    return apiResponse.data.device;
  }

  async updateDevice(id: string, updates: {
    warrantyExpires?: string;
    invoiceNumber?: string;
    invoiceDate?: string;
    comments?: string;
  }): Promise<any> {
    const response = await this.fetchWithAuth(`/devices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    const apiResponse = await this.handleResponse<{ success: boolean; data: { device: any } }>(response);
    return apiResponse.data.device;
  }

  async deleteDevice(id: string): Promise<void> {
    await this.fetchWithAuth(`/devices/${id}`, {
      method: 'DELETE',
    });
  }

  async getDeviceStats(): Promise<any> {
    const response = await this.fetchWithAuth('/devices/stats');
    const apiResponse = await this.handleResponse<{ success: boolean; data: { stats: any } }>(response);
    return apiResponse.data.stats;
  }

  // Generic HTTP methods for convenience
  async get(url: string): Promise<any> {
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<any>(response);
  }

  async post(url: string, data?: any): Promise<any> {
    const response = await this.fetchWithAuth(url, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
    return this.handleResponse<any>(response);
  }

  async put(url: string, data?: any): Promise<any> {
    const response = await this.fetchWithAuth(url, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
    return this.handleResponse<any>(response);
  }

  async delete(url: string): Promise<any> {
    const response = await this.fetchWithAuth(url, {
      method: 'DELETE',
    });
    return this.handleResponse<any>(response);
  }
}

export const apiService = new ApiService();
export default apiService; 