import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import { format, subDays, subWeeks, subMonths, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isValid } from 'date-fns';
import apiService from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

interface InsightsData {
  ticketVolumeData: Array<{ date: string; tickets: number }>;
  geographyData: Array<{ country: string; count: number }>;
  topAgents: Array<{ 
    id: string; 
    name: string; 
    ticketsResolved: number; 
    avgResolutionTime: number;
    totalActiveTime: number;
  }>;
  categoryData: Array<{ name: string; value: number; color: string }>;
  deviceModelData: Array<{ name: string; value: number; color: string | null }>;
  resolutionMetrics: {
    avgResolutionTime: number;
    minResolutionTime: number;
    maxResolutionTime: number;
  };
  agentActivityData: Array<{ 
    agentId: string; 
    name: string; 
    date: string; 
    hoursWorked: number;
    avgDailyHours: number;
  }>;
  unresolvedTickets: {
    count: number;
    overdueCount: number;
    avgAge: number;
    tickets: Array<{ id: string; title: string; daysOpen: number }>;
  };
  ticketFlowData: Array<{ stage: string; count: number; color: string }>;
}

type DateRangeOption = 'last_7_days' | 'last_30_days' | 'last_week' | 'last_month' | 'last_3_months' | 'last_6_months' | 'custom';

interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const Insights: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRangeOption, setDateRangeOption] = useState<DateRangeOption>('last_30_days');
  const [customDateRange, setCustomDateRange] = useState<DateRange>({ startDate: null, endDate: null });
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [data, setData] = useState<InsightsData | null>(null);

  // Calculate date range based on selected option
  const getDateRange = (): DateRange => {
    const now = new Date();
    
    switch (dateRangeOption) {
      case 'last_7_days':
        return {
          startDate: subDays(now, 7),
          endDate: now
        };
      case 'last_30_days':
        return {
          startDate: subDays(now, 30),
          endDate: now
        };
      case 'last_week':
        const lastWeekStart = startOfWeek(subWeeks(now, 1));
        const lastWeekEnd = endOfWeek(subWeeks(now, 1));
        return {
          startDate: lastWeekStart,
          endDate: lastWeekEnd
        };
      case 'last_month':
        const lastMonthStart = startOfMonth(subMonths(now, 1));
        const lastMonthEnd = endOfMonth(subMonths(now, 1));
        return {
          startDate: lastMonthStart,
          endDate: lastMonthEnd
        };
      case 'last_3_months':
        return {
          startDate: subMonths(now, 3),
          endDate: now
        };
      case 'last_6_months':
        return {
          startDate: subMonths(now, 6),
          endDate: now
        };
      case 'custom':
        return customDateRange;
      default:
        return {
          startDate: subDays(now, 30),
          endDate: now
        };
    }
  };

  useEffect(() => {
    loadInsightsData();
  }, [dateRangeOption, customDateRange, selectedAgent, selectedCategory]);

  const loadInsightsData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const dateRange = getDateRange();
      
      // Skip loading if custom date range is incomplete
      if (dateRangeOption === 'custom' && (!dateRange.startDate || !dateRange.endDate)) {
        setLoading(false);
        return;
      }
      
      console.log('🔍 INSIGHTS: Loading insights data with date range:', dateRange);
      
      const insights = await apiService.getInsights({
        startDate: dateRange.startDate ? format(dateRange.startDate, 'yyyy-MM-dd') : undefined,
        endDate: dateRange.endDate ? format(dateRange.endDate, 'yyyy-MM-dd') : undefined,
        agentId: selectedAgent === 'all' ? undefined : selectedAgent,
        category: selectedCategory === 'all' ? undefined : selectedCategory
      });
      
      console.log('🔍 INSIGHTS: Received insights data:', insights);
      console.log('🔍 INSIGHTS: Device model data:', insights.deviceModelData);
      
      setData(insights);
    } catch (err) {
      console.error('Failed to load insights data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatDuration = (hours: number): string => {
    return `${hours.toFixed(1)}h`;
  };

  const handleDateRangeChange = (option: DateRangeOption) => {
    setDateRangeOption(option);
    if (option !== 'custom') {
      setCustomDateRange({ startDate: null, endDate: null });
    }
  };

  const handleCustomDateChange = (field: 'startDate' | 'endDate', dateString: string) => {
    const date = dateString ? new Date(dateString) : null;
    setCustomDateRange(prev => ({
      ...prev,
      [field]: date && isValid(date) ? date : null
    }));
  };

  const formatDateForInput = (date: Date | null): string => {
    if (!date || !isValid(date)) return '';
    return format(date, 'yyyy-MM-dd');
  };

  const getDateRangeLabel = (): string => {
    const range = getDateRange();
    if (!range.startDate || !range.endDate) return 'Select date range';
    
    return `${format(range.startDate, 'MMM dd, yyyy')} - ${format(range.endDate, 'MMM dd, yyyy')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error Loading Insights</h3>
            <div className="mt-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data && dateRangeOption === 'custom' && (!customDateRange.startDate || !customDateRange.endDate)) {
    return (
      <div className="space-y-6">
        {/* Header with Date Range Selection */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Analytics Dashboard</h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Comprehensive insights into ticket metrics and agent performance
              </p>
            </div>
          </div>

          {/* Date Range Selection */}
          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Date Range
              </label>
              <select
                value={dateRangeOption}
                onChange={(e) => handleDateRangeChange(e.target.value as DateRangeOption)}
                className="block w-full sm:w-auto rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="last_7_days">Last 7 Days</option>
                <option value="last_30_days">Last 30 Days</option>
                <option value="last_week">Last Week</option>
                <option value="last_month">Last Month</option>
                <option value="last_3_months">Last 3 Months</option>
                <option value="last_6_months">Last 6 Months</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {dateRangeOption === 'custom' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={formatDateForInput(customDateRange.startDate)}
                    onChange={(e) => handleCustomDateChange('startDate', e.target.value)}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={formatDateForInput(customDateRange.endDate)}
                    onChange={(e) => handleCustomDateChange('endDate', e.target.value)}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
              </div>
            )}

            {dateRangeOption !== 'custom' && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Selected Range:</span> {getDateRangeLabel()}
              </div>
            )}
          </div>
        </div>

        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          Please select both start and end dates for custom range
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 py-8">
        No insights data available
      </div>
    );
  }

  // Ensure all data properties have default values
  const safeData = {
    ticketVolumeData: data.ticketVolumeData || [],
    geographyData: data.geographyData || [],
    topAgents: data.topAgents || [],
    categoryData: data.categoryData || [],
    deviceModelData: data.deviceModelData || [],
    resolutionMetrics: data.resolutionMetrics || {
      avgResolutionTime: 0,
      minResolutionTime: 0,
      maxResolutionTime: 0
    },
    agentActivityData: data.agentActivityData || [],
    unresolvedTickets: data.unresolvedTickets || {
      count: 0,
      overdueCount: 0,
      avgAge: 0,
      tickets: []
    },
    ticketFlowData: data.ticketFlowData || []
  };

  return (
    <div className="space-y-6">
      {/* Header with Enhanced Date Range Selection */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Analytics Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Comprehensive insights into ticket metrics and agent performance
            </p>
          </div>
        </div>

        {/* Enhanced Date Range and Filters */}
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Date Range Selection */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date Range
                </label>
                <select
                  value={dateRangeOption}
                  onChange={(e) => handleDateRangeChange(e.target.value as DateRangeOption)}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="last_7_days">Last 7 Days</option>
                  <option value="last_30_days">Last 30 Days</option>
                  <option value="last_week">Last Week</option>
                  <option value="last_month">Last Month</option>
                  <option value="last_3_months">Last 3 Months</option>
                  <option value="last_6_months">Last 6 Months</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>

              {dateRangeOption === 'custom' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={formatDateForInput(customDateRange.startDate)}
                      onChange={(e) => handleCustomDateChange('startDate', e.target.value)}
                      className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={formatDateForInput(customDateRange.endDate)}
                      onChange={(e) => handleCustomDateChange('endDate', e.target.value)}
                      className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    />
                  </div>
                </div>
              )}

              <div className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Selected Range:</span> {getDateRangeLabel()}
              </div>
            </div>

            {/* Other Filters */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Filters
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    value={selectedAgent}
                    onChange={(e) => setSelectedAgent(e.target.value)}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  >
                    <option value="all">All Agents</option>
                    {safeData.topAgents.map(agent => (
                      <option key={agent.id} value={agent.id}>{agent.name}</option>
                    ))}
                  </select>
                  
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  >
                    <option value="all">All Categories</option>
                    {safeData.categoryData.map(category => (
                      <option key={category.name} value={category.name}>{category.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Total Tickets
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {safeData.ticketVolumeData.reduce((sum, item) => sum + item.tickets, 0)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Avg Resolution Time
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {formatTime(safeData.resolutionMetrics.avgResolutionTime)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 14.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Unresolved Tickets
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {safeData.unresolvedTickets.count}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Active Agents
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {safeData.topAgents.length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ticket Volume Trends */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Ticket Volume Trends
          </h3>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {getDateRangeLabel()}
          </div>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={safeData.ticketVolumeData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="date" 
                className="text-xs fill-gray-600 dark:fill-gray-400"
              />
              <YAxis className="text-xs fill-gray-600 dark:fill-gray-400" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgb(31 41 55)', 
                  border: 'none', 
                  borderRadius: '8px',
                  color: 'white'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="tickets" 
                stroke="#3B82F6" 
                strokeWidth={2}
                dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#3B82F6', strokeWidth: 2, fill: '#3B82F6' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Distribution Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Category Distribution */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
            Category Distribution
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={safeData.categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {safeData.categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Device Model Distribution */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
            Device Model Distribution
          </h3>
          <div className="h-80">
            {(() => {
              console.log('🔍 DEVICE MODEL CHART: safeData.deviceModelData:', safeData.deviceModelData);
              console.log('🔍 DEVICE MODEL CHART: length check:', safeData.deviceModelData && safeData.deviceModelData.length > 0);
              return safeData.deviceModelData && safeData.deviceModelData.length > 0;
            })() ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={safeData.deviceModelData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {safeData.deviceModelData.map((entry, index) => (
                      <Cell key={`device-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgb(31 41 55)', 
                      border: 'none', 
                      borderRadius: '8px',
                      color: 'white'
                    }}
                    formatter={(value, name, props) => {
                      const total = safeData.deviceModelData.reduce((sum, item) => sum + item.value, 0);
                      const percentage = total > 0 ? ((value as number / total) * 100).toFixed(1) : '0.0';
                      return [`${value} tickets (${percentage}%)`, 'Count'];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <p className="mt-2 text-sm">No device model data available</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Geography and Top Agents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Geography */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
            Tickets by Location
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={(() => {
                    const total = safeData.geographyData.reduce((sum, item) => sum + item.count, 0);
                    return safeData.geographyData.map((item, index) => ({
                      ...item,
                      percentage: total > 0 ? ((item.count / total) * 100).toFixed(1) : '0.0'
                    }));
                  })()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ country, percentage }) => `${country}: ${percentage}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {safeData.geographyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgb(31 41 55)', 
                    border: 'none', 
                    borderRadius: '8px',
                    color: 'white'
                  }}
                  formatter={(value, name, props) => {
                    const total = safeData.geographyData.reduce((sum, item) => sum + item.count, 0);
                    const percentage = total > 0 ? ((value as number / total) * 100).toFixed(1) : '0.0';
                    return [`${value} tickets (${percentage}%)`, 'Count'];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Agents */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
            Top Performing Agents
          </h3>
          <div className="space-y-4">
            {safeData.topAgents.slice(0, 5).map((agent, index) => (
              <div key={agent.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-medium ${
                    index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-500' : 'bg-blue-500'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {agent.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {agent.ticketsResolved} tickets resolved
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formatTime(agent.avgResolutionTime)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    avg resolution
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Agent Activity and Resolution Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent Activity Time */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
            Agent Activity Time
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={safeData.agentActivityData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="name" 
                  className="text-xs fill-gray-600 dark:fill-gray-400"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis className="text-xs fill-gray-600 dark:fill-gray-400" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgb(31 41 55)', 
                    border: 'none', 
                    borderRadius: '8px',
                    color: 'white'
                  }}
                  formatter={(value) => [formatDuration(value as number), 'Hours Worked']}
                />
                <Bar dataKey="hoursWorked" fill="#8B5CF6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Resolution Time Metrics */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
            Resolution Time Analysis
          </h3>
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatTime(safeData.resolutionMetrics.minResolutionTime)}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Fastest</p>
              </div>
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatTime(safeData.resolutionMetrics.avgResolutionTime)}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Average</p>
              </div>
              <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {formatTime(safeData.resolutionMetrics.maxResolutionTime)}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Slowest</p>
              </div>
            </div>
            
            {/* Unresolved Tickets Details */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                Unresolved Tickets Overview
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
                    {safeData.unresolvedTickets.overdueCount}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Overdue</p>
                </div>
                <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                    {safeData.unresolvedTickets.avgAge}d
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Avg Age</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Insights; 