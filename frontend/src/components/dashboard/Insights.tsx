import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
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

type TimeRange = 'daily' | 'monthly' | 'quarterly';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const Insights: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('monthly');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [data, setData] = useState<InsightsData | null>(null);

  useEffect(() => {
    loadInsightsData();
  }, [timeRange, selectedAgent, selectedCategory]);

  const loadInsightsData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const insights = await apiService.getInsights({
        timeRange,
        agentId: selectedAgent === 'all' ? undefined : selectedAgent,
        category: selectedCategory === 'all' ? undefined : selectedCategory
      });
      
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

  if (!data) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 py-8">
        No insights data available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Analytics Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Comprehensive insights into ticket metrics and agent performance
            </p>
          </div>
          
          {/* Filters */}
          <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-3">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              className="block w-full sm:w-auto rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="daily">Daily View</option>
              <option value="monthly">Monthly View</option>
              <option value="quarterly">Quarterly View</option>
            </select>
            
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="block w-full sm:w-auto rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="all">All Agents</option>
              {data.topAgents.map(agent => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>
            
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="block w-full sm:w-auto rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="all">All Categories</option>
              {data.categoryData.map(category => (
                <option key={category.name} value={category.name}>{category.name}</option>
              ))}
            </select>
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
                    {data.ticketVolumeData.reduce((sum, item) => sum + item.tickets, 0)}
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
                    {formatTime(data.resolutionMetrics.avgResolutionTime)}
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
                    {data.unresolvedTickets.count}
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
                    {data.topAgents.length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ticket Volume Trends */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Ticket Volume Trends
            </h3>
            <div className="text-sm text-gray-500 dark:text-gray-400 capitalize">
              {timeRange} View
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.ticketVolumeData}>
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

        {/* Category Distribution */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
            Category Distribution
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {data.categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
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
                    const total = data.geographyData.reduce((sum, item) => sum + item.count, 0);
                    return data.geographyData.map((item, index) => ({
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
                  {data.geographyData.map((entry, index) => (
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
                    const total = data.geographyData.reduce((sum, item) => sum + item.count, 0);
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
            {data.topAgents.slice(0, 5).map((agent, index) => (
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
              <BarChart data={data.agentActivityData}>
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
                  {formatTime(data.resolutionMetrics.minResolutionTime)}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Fastest</p>
              </div>
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatTime(data.resolutionMetrics.avgResolutionTime)}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Average</p>
              </div>
              <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {formatTime(data.resolutionMetrics.maxResolutionTime)}
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
                    {data.unresolvedTickets.overdueCount}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Overdue</p>
                </div>
                <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                    {data.unresolvedTickets.avgAge}d
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