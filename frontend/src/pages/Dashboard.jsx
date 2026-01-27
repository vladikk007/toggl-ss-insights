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
  ResponsiveContainer
} from 'recharts';
import { analytics } from '../api';

// Vibrant color palette for charts
const COLORS = [
  '#38bdf8', '#fbbf24', '#34d399', '#fb7185', '#a78bfa',
  '#f472b6', '#22d3ee', '#84cc16', '#f97316', '#818cf8'
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
  'Payout': 300,
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

// Helper to parse date string as local time
const parseDate = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Helper to get start of week for date
const getStartOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

// Helper to get start/end dates for a range
const getRangeDates = (range, referenceDate = new Date()) => {
  const ref = new Date(referenceDate);
  let start, end;

  switch (range) {
    case 'week':
      start = new Date(ref);
      start.setDate(getStartOfWeek(start).getDate());
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

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <p className="label">{label}</p>
        <p className="value">{payload[0].value.toFixed(1)} hours</p>
      </div>
    );
  }
  return null;
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
    <div className="min-h-screen bg-mesh">
      {/* Ambient background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative border-b border-white/5 bg-black/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-2 rounded-xl border border-white/5">
                <img
                  src="/logo.png"
                  alt="SybriSoft Logo"
                  className="h-8"
                />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight">
                  <span className="text-slate-200">Toggl</span>
                  <span className="text-cyan-400 ml-1">SybriSoft</span>
                  <span className="text-slate-500 ml-1 font-light">Insights</span>
                </h1>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="btn-ghost px-4 py-2 rounded-lg text-sm"
            >
              Sign Out
            </button>
          </div>

          {/* Date Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Range Selector */}
            <select
              value={range}
              onChange={(e) => handleRangeChange(e.target.value)}
              className="input-dark px-4 py-2.5 rounded-lg text-sm min-w-[140px]"
            >
              {TIME_RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>

            {/* Navigation Arrows */}
            {range !== 'custom' && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleNavigate(-1)}
                  className="nav-btn p-2.5 rounded-lg"
                  title={`Previous ${range}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <span className="px-4 py-2 font-medium text-slate-300 min-w-[180px] text-center data-text text-sm">
                  {getDisplayLabel(range, startDate, endDate)}
                </span>

                <button
                  onClick={() => handleNavigate(1)}
                  className="nav-btn p-2.5 rounded-lg"
                  title={`Next ${range}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}

            <div className="h-6 w-px bg-white/10 mx-1 hidden sm:block" />

            {/* Custom Date Pickers */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 uppercase tracking-wider">From</label>
              <input
                type="date"
                value={startDate}
                onChange={handleStartDateChange}
                className="input-dark px-3 py-2 rounded-lg text-sm data-text"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 uppercase tracking-wider">To</label>
              <input
                type="date"
                value={endDate}
                onChange={handleEndDateChange}
                className="input-dark px-3 py-2 rounded-lg text-sm data-text"
              />
            </div>
          </div>

          {/* Client Limits Editor */}
          <div className="mt-4 pt-4 border-t border-white/5">
            <button
              onClick={() => setShowLimitsEditor(!showLimitsEditor)}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
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
              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {Object.keys(clientLimits).map((clientName) => (
                  <div key={clientName} className="glass-card p-3">
                    <label className="text-xs text-slate-500 mb-1.5 block truncate">{clientName}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={clientLimits[clientName] || ''}
                        onChange={(e) => handleLimitChange(clientName, e.target.value)}
                        className="w-full px-2 py-1.5 text-sm input-dark rounded-lg data-text"
                        min="0"
                        step="1"
                      />
                      <span className="text-xs text-slate-600">hrs</span>
                    </div>
                  </div>
                ))}
                {clientData
                  .filter(c => c.clientName !== 'No Client' && !clientLimits.hasOwnProperty(c.clientName))
                  .map((client) => (
                    <div key={client.clientName} className="glass-card p-3">
                      <label className="text-xs text-slate-500 mb-1.5 block truncate">{client.clientName}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value=""
                          onChange={(e) => handleLimitChange(client.clientName, e.target.value)}
                          className="w-full px-2 py-1.5 text-sm input-dark rounded-lg data-text"
                          min="0"
                          step="1"
                          placeholder="0"
                        />
                        <span className="text-xs text-slate-600">hrs</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="relative max-w-[1600px] mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3">
            <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-rose-300">{error}</span>
          </div>
        )}

        {loading ? (
          <LoadingState />
        ) : (
          <>
            {/* Summary Cards */}
            {summary && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <SummaryCard
                  title="Total Hours"
                  value={summary.totalHours.toLocaleString()}
                  icon={<ClockIcon />}
                  color="cyan"
                  delay={1}
                />
                <SummaryCard
                  title="Active Users"
                  value={summary.totalUsers}
                  icon={<UsersIcon />}
                  color="amber"
                  delay={2}
                />
                <SummaryCard
                  title="Projects"
                  value={summary.totalProjects}
                  icon={<FolderIcon />}
                  color="emerald"
                  delay={3}
                />
                <SummaryCard
                  title="Clients"
                  value={summary.totalClients}
                  icon={<BuildingIcon />}
                  color="violet"
                  delay={4}
                />
              </div>
            )}

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Client Table */}
              <div className="glass-card p-6 opacity-0 animate-fade-in-up stagger-5">
                <h2 className="text-base font-semibold text-slate-200 mb-4 flex items-center gap-2">
                  <span className="w-1 h-4 bg-cyan-400 rounded-full" />
                  Hours by Client
                </h2>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Client</th>
                        <th className="text-right">Hours</th>
                        <th className="text-right">Limit</th>
                        <th className="text-right">Fulfillment</th>
                        <th className="text-right">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientData.map((client, index) => {
                        const totalHours = clientData.reduce((sum, c) => sum + c.totalHours, 0);
                        const percentage = totalHours > 0 ? ((client.totalHours / totalHours) * 100).toFixed(1) : 0;
                        const limit = clientLimits[client.clientName] || 0;
                        const fulfillment = limit > 0 ? ((client.totalHours / limit) * 100).toFixed(1) : null;
                        const fulfillmentClass = fulfillment === null
                          ? 'text-slate-600'
                          : fulfillment >= 100
                            ? 'fulfillment-excellent font-semibold'
                            : fulfillment >= 80
                              ? 'fulfillment-good'
                              : fulfillment >= 50
                                ? 'fulfillment-warning'
                                : 'fulfillment-low';

                        const rowClass = fulfillment !== null && fulfillment >= 100
                          ? 'row-fulfillment-100'
                          : fulfillment !== null && fulfillment >= 80
                            ? 'row-fulfillment-80'
                            : '';

                        return (
                          <tr key={client.clientId || index} className={rowClass}>
                            <td>{client.clientName}</td>
                            <td className="text-right">{client.totalHours.toFixed(1)}</td>
                            <td className="text-right">{limit > 0 ? limit : '—'}</td>
                            <td className={`text-right ${fulfillmentClass}`}>
                              {fulfillment !== null ? `${fulfillment}%` : '—'}
                            </td>
                            <td className="text-right">{percentage}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Client Hours Bar Chart */}
              <div className="glass-card p-6 opacity-0 animate-fade-in-up stagger-6">
                <h2 className="text-base font-semibold text-slate-200 mb-4 flex items-center gap-2">
                  <span className="w-1 h-4 bg-amber-400 rounded-full" />
                  Client Distribution
                </h2>
                <div className="chart-container">
                  {clientData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={clientData} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} />
                        <YAxis
                          dataKey="clientName"
                          type="category"
                          width={100}
                          tick={{ fill: '#94a3b8', fontSize: 12 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(56, 189, 248, 0.1)' }} />
                        <Bar dataKey="totalHours" fill="#38bdf8" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState />
                  )}
                </div>
              </div>

              {/* Project Chart - Full Width */}
              <div className="glass-card p-6 lg:col-span-2 opacity-0 animate-fade-in-up stagger-7">
                <h2 className="text-base font-semibold text-slate-200 mb-4 flex items-center gap-2">
                  <span className="w-1 h-4 bg-emerald-400 rounded-full" />
                  Top 10 Projects
                </h2>
                <div className="chart-container">
                  {projectData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={projectData.slice(0, 10)} margin={{ bottom: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis
                          dataKey="projectName"
                          angle={-45}
                          textAnchor="end"
                          height={100}
                          tick={{ fill: '#94a3b8', fontSize: 11 }}
                          tickLine={false}
                          axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                        />
                        <YAxis
                          stroke="#64748b"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(52, 211, 153, 0.1)' }} />
                        <Bar
                          dataKey="totalHours"
                          fill="#34d399"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState />
                  )}
                </div>
              </div>

              {/* User Chart */}
              <div className="glass-card p-6 opacity-0 animate-fade-in-up stagger-8">
                <h2 className="text-base font-semibold text-slate-200 mb-4 flex items-center gap-2">
                  <span className="w-1 h-4 bg-violet-400 rounded-full" />
                  Hours by User
                </h2>
                <div className="chart-container">
                  {userData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={userData} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} />
                        <YAxis
                          dataKey="userName"
                          type="category"
                          width={100}
                          tick={{ fill: '#94a3b8', fontSize: 12 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(167, 139, 250, 0.1)' }} />
                        <Bar dataKey="totalHours" fill="#a78bfa" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState />
                  )}
                </div>
              </div>

              {/* User Table */}
              <div className="glass-card p-6 opacity-0 animate-fade-in-up stagger-8">
                <h2 className="text-base font-semibold text-slate-200 mb-4 flex items-center gap-2">
                  <span className="w-1 h-4 bg-rose-400 rounded-full" />
                  User Breakdown
                </h2>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th className="text-right">Hours</th>
                        <th className="text-right">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userData.map((user, index) => {
                        const totalHours = userData.reduce((sum, u) => sum + u.totalHours, 0);
                        const percentage = totalHours > 0 ? ((user.totalHours / totalHours) * 100).toFixed(1) : 0;

                        return (
                          <tr key={user.userId || index}>
                            <td>{user.userName}</td>
                            <td className="text-right">{user.totalHours.toFixed(1)}</td>
                            <td className="text-right">{percentage}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Client Pie Chart */}
              <div className="glass-card p-6 opacity-0 animate-fade-in-up stagger-8">
                <h2 className="text-base font-semibold text-slate-200 mb-4 flex items-center gap-2">
                  <span className="w-1 h-4 bg-pink-400 rounded-full" />
                  Time Distribution by Client
                </h2>
                <div className="chart-container">
                  {clientData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={clientData}
                          dataKey="totalHours"
                          nameKey="clientName"
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          label={({ clientName, percent }) =>
                            `${clientName} (${(percent * 100).toFixed(0)}%)`
                          }
                          labelLine={{ stroke: '#64748b', strokeWidth: 1 }}
                        >
                          {clientData.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                              stroke="transparent"
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState />
                  )}
                </div>
              </div>

              {/* User Pie Chart */}
              <div className="glass-card p-6 opacity-0 animate-fade-in-up stagger-8">
                <h2 className="text-base font-semibold text-slate-200 mb-4 flex items-center gap-2">
                  <span className="w-1 h-4 bg-orange-400 rounded-full" />
                  Time Distribution by User
                </h2>
                <div className="chart-container">
                  {userData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={userData}
                          dataKey="totalHours"
                          nameKey="userName"
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          label={({ userName, percent }) =>
                            `${userName} (${(percent * 100).toFixed(0)}%)`
                          }
                          labelLine={{ stroke: '#64748b', strokeWidth: 1 }}
                        >
                          {userData.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                              stroke="transparent"
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState />
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="relative border-t border-white/5 mt-12">
        <div className="max-w-[1600px] mx-auto px-6 py-6 text-center text-sm text-slate-600">
          Created by SybriSoft · © {new Date().getFullYear()} · All Rights Reserved
        </div>
      </footer>
    </div>
  );
}

// Summary Card Component
function SummaryCard({ title, value, icon, color, delay }) {
  const colorClasses = {
    cyan: 'text-cyan-400',
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
    violet: 'text-violet-400',
  };

  return (
    <div className={`glass-card stat-card ${color} p-6 opacity-0 animate-fade-in-up stagger-${delay}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{title}</p>
          <p className={`text-3xl font-bold data-text ${colorClasses[color]}`}>{value}</p>
        </div>
        <div className={`${colorClasses[color]} opacity-50`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// Loading State Component
function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton h-80" />
        ))}
      </div>
    </div>
  );
}

// Empty State Component
function EmptyState() {
  return (
    <div className="h-64 flex flex-col items-center justify-center text-slate-600">
      <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <span className="text-sm">No data available</span>
    </div>
  );
}

// Icons
function ClockIcon() {
  return (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

export default Dashboard;
