import { useState, useEffect } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { analytics } from '../api';

const COLORS = [
  '#61D09C', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
];

const TIME_RANGES = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' }
];

// Default monthly limits for clients (in hours)
const DEFAULT_CLIENT_LIMITS = {
  'Payout': 240,
  'Autocar': 70,
  'Pilex': 30,
  'Sentop': 20,
  'SybriSoft': 20
};

// Helper to format date as YYYY-MM-DD (local time)
const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to parse date string as local time (avoids UTC timezone issues)
const parseDate = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Helper to get start/end dates for a range
const getRangeDates = (range, referenceDate = new Date()) => {
  const ref = new Date(referenceDate);
  let start, end;

  switch (range) {
    case 'week':
      start = new Date(ref);
      start.setDate(ref.getDate() - ref.getDay());
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      break;
    case 'month':
      start = new Date(ref.getFullYear(), ref.getMonth(), 1);
      end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
      break;
    case 'quarter':
      const quarter = Math.floor(ref.getMonth() / 3);
      start = new Date(ref.getFullYear(), quarter * 3, 1);
      end = new Date(ref.getFullYear(), quarter * 3 + 3, 0);
      break;
    case 'year':
      start = new Date(ref.getFullYear(), 0, 1);
      end = new Date(ref.getFullYear(), 11, 31);
      break;
    default:
      start = new Date(ref.getFullYear(), ref.getMonth(), 1);
      end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  }

  return { start: formatDate(start), end: formatDate(end) };
};

// Helper to navigate dates
const navigateDates = (range, startDate, direction) => {
  const start = parseDate(startDate);
  let newStart;

  switch (range) {
    case 'week':
      newStart = new Date(start);
      newStart.setDate(start.getDate() + (direction * 7));
      break;
    case 'month':
      newStart = new Date(start.getFullYear(), start.getMonth() + direction, 1);
      break;
    case 'quarter':
      newStart = new Date(start.getFullYear(), start.getMonth() + (direction * 3), 1);
      break;
    case 'year':
      newStart = new Date(start.getFullYear() + direction, 0, 1);
      break;
    default:
      newStart = new Date(start);
      newStart.setDate(start.getDate() + (direction * 7));
  }

  return getRangeDates(range, newStart);
};

// Helper to format display label
const getDisplayLabel = (range, startDate, endDate) => {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  switch (range) {
    case 'week':
      return `${months[start.getMonth()]} ${start.getDate()} - ${months[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
    case 'month':
      return `${months[start.getMonth()]} ${start.getFullYear()}`;
    case 'quarter':
      const quarter = Math.floor(start.getMonth() / 3) + 1;
      return `Q${quarter} ${start.getFullYear()}`;
    case 'year':
      return `${start.getFullYear()}`;
    case 'custom':
      return `${startDate} - ${endDate}`;
    default:
      return `${startDate} - ${endDate}`;
  }
};

function Dashboard({ onLogout }) {
  const [range, setRange] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [summary, setSummary] = useState(null);
  const [clientData, setClientData] = useState([]);
  const [projectData, setProjectData] = useState([]);
  const [userData, setUserData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clientLimits, setClientLimits] = useState(() => {
    const saved = localStorage.getItem('clientLimits');
    return saved ? JSON.parse(saved) : DEFAULT_CLIENT_LIMITS;
  });
  const [showLimitsEditor, setShowLimitsEditor] = useState(false);

  // Initialize dates on mount
  useEffect(() => {
    const { start, end } = getRangeDates('month');
    setStartDate(start);
    setEndDate(end);
  }, []);

  // Save client limits to localStorage
  useEffect(() => {
    localStorage.setItem('clientLimits', JSON.stringify(clientLimits));
  }, [clientLimits]);

  // Fetch data when dates change
  useEffect(() => {
    if (startDate && endDate) {
      fetchData();
    }
  }, [startDate, endDate]);

  const fetchData = async () => {
    setLoading(true);
    setError('');

    const params = { startDate, endDate };

    try {
      const [summaryRes, clientRes, projectRes, userRes] = await Promise.all([
        analytics.getSummary(params),
        analytics.getByClient(params),
        analytics.getByProject(params),
        analytics.getByUser(params)
      ]);

      setSummary(summaryRes.data);
      setClientData(clientRes.data);
      setProjectData(projectRes.data);
      setUserData(userRes.data);
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRangeChange = (newRange) => {
    setRange(newRange);
    if (newRange !== 'custom') {
      const { start, end } = getRangeDates(newRange);
      setStartDate(start);
      setEndDate(end);
    }
  };

  const handleNavigate = (direction) => {
    if (range === 'custom') return;
    const { start, end } = navigateDates(range, startDate, direction);
    setStartDate(start);
    setEndDate(end);
  };

  const handleStartDateChange = (e) => {
    setStartDate(e.target.value);
    if (range !== 'custom') {
      setRange('custom');
    }
  };

  const handleEndDateChange = (e) => {
    setEndDate(e.target.value);
    if (range !== 'custom') {
      setRange('custom');
    }
  };

  const handleLimitChange = (clientName, value) => {
    setClientLimits(prev => ({
      ...prev,
      [clientName]: value === '' ? 0 : parseFloat(value)
    }));
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow border-t-4 border-brand">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="SybriSoft Logo"
                className="h-8 bg-gray-800 p-1 rounded"
              />
              <h1 className="text-xl font-bold text-gray-800">Toggl Insights</h1>
            </div>
            <button
              onClick={onLogout}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Logout
            </button>
          </div>

          {/* Date Controls */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Range Selector */}
            <select
              value={range}
              onChange={(e) => handleRangeChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand"
            >
              {TIME_RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>

            {/* Navigation Arrows */}
            {range !== 'custom' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleNavigate(-1)}
                  className="p-2 rounded-md border border-gray-300 hover:bg-brand-light hover:text-white focus:outline-none focus:ring-2 focus:ring-brand"
                  title={`Previous ${range}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <span className="px-3 py-2 font-medium text-gray-700 min-w-[180px] text-center">
                  {getDisplayLabel(range, startDate, endDate)}
                </span>

                <button
                  onClick={() => handleNavigate(1)}
                  className="p-2 rounded-md border border-gray-300 hover:bg-brand-light hover:text-white focus:outline-none focus:ring-2 focus:ring-brand"
                  title={`Next ${range}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}

            {/* Custom Date Pickers */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">From:</label>
              <input
                type="date"
                value={startDate}
                onChange={handleStartDateChange}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <label className="text-sm text-gray-600">To:</label>
              <input
                type="date"
                value={endDate}
                onChange={handleEndDateChange}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>

          {/* Client Limits Editor */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={() => setShowLimitsEditor(!showLimitsEditor)}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
            >
              <svg
                className={`w-4 h-4 transform transition-transform ${showLimitsEditor ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Monthly Client Limits
            </button>

            {showLimitsEditor && (
              <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {Object.keys(clientLimits).map((clientName) => (
                  <div key={clientName} className="flex flex-col">
                    <label className="text-xs text-gray-500 mb-1">{clientName}</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={clientLimits[clientName] || ''}
                        onChange={(e) => handleLimitChange(clientName, e.target.value)}
                        className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-brand"
                        min="0"
                        step="1"
                      />
                      <span className="text-xs text-gray-500">hrs</span>
                    </div>
                  </div>
                ))}
                {/* Add new client limit */}
                {clientData
                  .filter(c => c.clientName !== 'No Client' && !clientLimits.hasOwnProperty(c.clientName))
                  .map((client) => (
                    <div key={client.clientName} className="flex flex-col">
                      <label className="text-xs text-gray-500 mb-1">{client.clientName}</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value=""
                          onChange={(e) => handleLimitChange(client.clientName, e.target.value)}
                          className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-brand"
                          min="0"
                          step="1"
                          placeholder="0"
                        />
                        <span className="text-xs text-gray-500">hrs</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-500">Loading...</div>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            {summary && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <SummaryCard title="Total Hours" value={summary.totalHours} />
                <SummaryCard title="Active Users" value={summary.totalUsers} />
                <SummaryCard title="Projects" value={summary.totalProjects} />
                <SummaryCard title="Clients" value={summary.totalClients} />
              </div>
            )}

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Client Allocation Pie Chart */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-lg font-semibold mb-4">Time by Client</h2>
                {clientData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={clientData}
                        dataKey="totalHours"
                        nameKey="clientName"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ clientName, percent }) =>
                          `${clientName} (${(percent * 100).toFixed(0)}%)`
                        }
                      >
                        {clientData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [`${value} hours`, 'Time']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-gray-500">
                    No data available
                  </div>
                )}
              </div>

              {/* Client Hours Bar Chart */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-lg font-semibold mb-4">Hours by Client</h2>
                {clientData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={clientData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis
                        dataKey="clientName"
                        type="category"
                        width={120}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        formatter={(value) => [`${value} hours`, 'Time']}
                      />
                      <Bar dataKey="totalHours" fill="#61D09C" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-gray-500">
                    No data available
                  </div>
                )}
              </div>

              {/* Project Allocation */}
              <div className="bg-white p-6 rounded-lg shadow lg:col-span-2">
                <h2 className="text-lg font-semibold mb-4">Top Projects</h2>
                {projectData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={projectData.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="projectName"
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis />
                      <Tooltip
                        formatter={(value) => [`${value} hours`, 'Time']}
                        labelFormatter={(label) => `Project: ${label}`}
                      />
                      <Legend />
                      <Bar
                        dataKey="totalHours"
                        name="Hours"
                        fill="#10B981"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-gray-500">
                    No data available
                  </div>
                )}
              </div>

              {/* Hours by User Chart */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-lg font-semibold mb-4">Hours by User</h2>
                {userData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={userData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis
                        dataKey="userName"
                        type="category"
                        width={120}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        formatter={(value) => [`${value} hours`, 'Time']}
                      />
                      <Bar dataKey="totalHours" fill="#8B5CF6" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-gray-500">
                    No data available
                  </div>
                )}
              </div>

              {/* User Table */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-lg font-semibold mb-4">Hours by User</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Hours
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          % of Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {userData.map((user, index) => {
                        const totalHours = userData.reduce(
                          (sum, u) => sum + u.totalHours,
                          0
                        );
                        const percentage =
                          totalHours > 0
                            ? ((user.totalHours / totalHours) * 100).toFixed(1)
                            : 0;

                        return (
                          <tr key={user.userId || index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {user.userName}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                              {user.totalHours.toFixed(1)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                              {percentage}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Client Table */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-lg font-semibold mb-4">Hours by Client</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Client
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Hours
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Limit
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Fulfillment
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          % of Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {clientData.map((client, index) => {
                        const totalHours = clientData.reduce(
                          (sum, c) => sum + c.totalHours,
                          0
                        );
                        const percentage =
                          totalHours > 0
                            ? ((client.totalHours / totalHours) * 100).toFixed(1)
                            : 0;
                        const limit = clientLimits[client.clientName] || 0;
                        const fulfillment = limit > 0
                          ? ((client.totalHours / limit) * 100).toFixed(1)
                          : null;
                        const fulfillmentColor = fulfillment === null
                          ? 'text-gray-400'
                          : fulfillment >= 100
                            ? 'text-green-600 font-semibold'
                            : fulfillment >= 80
                              ? 'text-brand font-medium'
                              : fulfillment >= 50
                                ? 'text-yellow-600'
                                : 'text-red-500';

                        return (
                          <tr key={client.clientId || index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {client.clientName}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                              {client.totalHours.toFixed(1)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                              {limit > 0 ? limit : '-'}
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${fulfillmentColor}`}>
                              {fulfillment !== null ? `${fulfillment}%` : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                              {percentage}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* User Pie Chart */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-lg font-semibold mb-4">Time by User</h2>
                {userData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={userData}
                        dataKey="totalHours"
                        nameKey="userName"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ userName, percent }) =>
                          `${userName} (${(percent * 100).toFixed(0)}%)`
                        }
                      >
                        {userData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [`${value} hours`, 'Time']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-gray-500">
                    No data available
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-sm text-gray-500">
          Created by SybriSoft. © Copyrights 2026. All Rights Reserved.
        </div>
      </footer>
    </div>
  );
}

function SummaryCard({ title, value }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

export default Dashboard;
