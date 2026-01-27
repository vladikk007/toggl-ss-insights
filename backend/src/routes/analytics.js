const express = require('express');
const db = require('../db');
const { verifyToken } = require('../auth');

const router = express.Router();

// Apply auth to all analytics routes
router.use(verifyToken);

// Get time allocation by client
router.get('/by-client', async (req, res) => {
  try {
    const { range, startDate, endDate } = req.query;
    const { start, end } = getDateFilter(range, startDate, endDate);

    const result = await db.query(`
      SELECT
        COALESCE(c.name, 'No Client') as client_name,
        c.t_client_id as client_id,
        SUM(te.duration_seconds) as total_seconds,
        COUNT(te.t_time_entry_id) as entry_count
      FROM t_time_entry te
      LEFT JOIN t_project p ON te.t_project_id = p.t_project_id
      LEFT JOIN t_client c ON p.t_client_id = c.t_client_id
      WHERE te.start >= $1 AND te.start < $2
      GROUP BY c.t_client_id, c.name
      ORDER BY total_seconds DESC
    `, [start, end]);

    const data = result.rows.map(row => ({
      clientName: row.client_name,
      clientId: row.client_id,
      totalHours: Math.round(row.total_seconds / 3600 * 100) / 100,
      entryCount: parseInt(row.entry_count)
    }));

    res.json(data);
  } catch (err) {
    console.error('Error fetching client analytics:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get time allocation by project
router.get('/by-project', async (req, res) => {
  try {
    const { range, startDate, endDate, clientId } = req.query;
    const { start, end } = getDateFilter(range, startDate, endDate);

    let query = `
      SELECT
        COALESCE(p.name, 'No Project') as project_name,
        p.t_project_id as project_id,
        COALESCE(c.name, 'No Client') as client_name,
        SUM(te.duration_seconds) as total_seconds,
        COUNT(te.t_time_entry_id) as entry_count
      FROM t_time_entry te
      LEFT JOIN t_project p ON te.t_project_id = p.t_project_id
      LEFT JOIN t_client c ON p.t_client_id = c.t_client_id
      WHERE te.start >= $1 AND te.start < $2
    `;

    const params = [start, end];

    if (clientId) {
      query += ` AND c.t_client_id = $3`;
      params.push(clientId);
    }

    query += `
      GROUP BY p.t_project_id, p.name, c.name
      ORDER BY total_seconds DESC
    `;

    const result = await db.query(query, params);

    const data = result.rows.map(row => ({
      projectName: row.project_name,
      projectId: row.project_id,
      clientName: row.client_name,
      totalHours: Math.round(row.total_seconds / 3600 * 100) / 100,
      entryCount: parseInt(row.entry_count)
    }));

    res.json(data);
  } catch (err) {
    console.error('Error fetching project analytics:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get time allocation by user
router.get('/by-user', async (req, res) => {
  try {
    const { range, startDate, endDate } = req.query;
    const { start, end } = getDateFilter(range, startDate, endDate);

    const result = await db.query(`
      SELECT
        u.name as user_name,
        u.t_user_id as user_id,
        SUM(te.duration_seconds) as total_seconds,
        COUNT(te.t_time_entry_id) as entry_count
      FROM t_time_entry te
      JOIN t_user u ON te.t_user_id = u.t_user_id
      WHERE te.start >= $1 AND te.start < $2
      GROUP BY u.t_user_id, u.name
      ORDER BY total_seconds DESC
    `, [start, end]);

    const data = result.rows.map(row => ({
      userName: row.user_name,
      userId: row.user_id,
      totalHours: Math.round(row.total_seconds / 3600 * 100) / 100,
      entryCount: parseInt(row.entry_count)
    }));

    res.json(data);
  } catch (err) {
    console.error('Error fetching user analytics:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get summary stats
router.get('/summary', async (req, res) => {
  try {
    const { range, startDate, endDate } = req.query;
    const { start, end } = getDateFilter(range, startDate, endDate);

    const result = await db.query(`
      SELECT
        COUNT(DISTINCT te.t_user_id) as total_users,
        COUNT(DISTINCT p.t_project_id) as total_projects,
        COUNT(DISTINCT c.t_client_id) as total_clients,
        SUM(te.duration_seconds) as total_seconds,
        COUNT(te.t_time_entry_id) as total_entries
      FROM t_time_entry te
      LEFT JOIN t_project p ON te.t_project_id = p.t_project_id
      LEFT JOIN t_client c ON p.t_client_id = c.t_client_id
      WHERE te.start >= $1 AND te.start < $2
    `, [start, end]);

    const row = result.rows[0];
    res.json({
      totalUsers: parseInt(row.total_users) || 0,
      totalProjects: parseInt(row.total_projects) || 0,
      totalClients: parseInt(row.total_clients) || 0,
      totalHours: Math.round((row.total_seconds || 0) / 3600 * 100) / 100,
      totalEntries: parseInt(row.total_entries) || 0
    });
  } catch (err) {
    console.error('Error fetching summary:', err);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// Get projects with users who worked on them
router.get('/projects-with-users', async (req, res) => {
  try {
    const { range, startDate, endDate } = req.query;
    const { start, end } = getDateFilter(range, startDate, endDate);

    const result = await db.query(`
      SELECT
        COALESCE(p.name, 'No Project') as project_name,
        p.t_project_id as project_id,
        COALESCE(c.name, 'No Client') as client_name,
        c.t_client_id as client_id,
        u.name as user_name,
        u.t_user_id as user_id,
        SUM(te.duration_seconds) as total_seconds,
        COUNT(te.t_time_entry_id) as entry_count
      FROM t_time_entry te
      LEFT JOIN t_project p ON te.t_project_id = p.t_project_id
      LEFT JOIN t_client c ON p.t_client_id = c.t_client_id
      JOIN t_user u ON te.t_user_id = u.t_user_id
      WHERE te.start >= $1 AND te.start < $2
      GROUP BY p.t_project_id, p.name, c.t_client_id, c.name, u.t_user_id, u.name
      ORDER BY c.name, p.name, total_seconds DESC
    `, [start, end]);

    // Group by project
    const projectsMap = new Map();

    result.rows.forEach(row => {
      const projectKey = row.project_id || 'no-project';

      if (!projectsMap.has(projectKey)) {
        projectsMap.set(projectKey, {
          projectName: row.project_name,
          projectId: row.project_id,
          clientName: row.client_name,
          clientId: row.client_id,
          totalHours: 0,
          users: []
        });
      }

      const project = projectsMap.get(projectKey);
      const userHours = Math.round(row.total_seconds / 3600 * 100) / 100;
      project.totalHours += userHours;
      project.users.push({
        userName: row.user_name,
        userId: row.user_id,
        hours: userHours,
        entryCount: parseInt(row.entry_count)
      });
    });

    // Convert to array and sort by total hours
    const data = Array.from(projectsMap.values())
      .map(p => ({ ...p, totalHours: Math.round(p.totalHours * 100) / 100 }))
      .sort((a, b) => b.totalHours - a.totalHours);

    res.json(data);
  } catch (err) {
    console.error('Error fetching projects with users:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get list of clients for filtering
router.get('/clients', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT t_client_id, name, archived
      FROM t_client
      ORDER BY name
    `);

    res.json(result.rows.map(row => ({
      id: row.t_client_id,
      name: row.name,
      archived: row.archived
    })));
  } catch (err) {
    console.error('Error fetching clients:', err);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// Helper function to get date filter based on range or custom dates
function getDateFilter(range, startDate, endDate) {
  // If custom dates provided, use them
  if (startDate && endDate) {
    return {
      start: new Date(startDate),
      end: new Date(endDate + 'T23:59:59.999Z')
    };
  }

  const now = new Date();
  let start, end;

  switch (range) {
    case 'week':
      start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 7);
      break;

    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;

    case 'quarter':
      const quarter = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), quarter * 3, 1);
      end = new Date(now.getFullYear(), quarter * 3 + 3, 1);
      break;

    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear() + 1, 0, 1);
      break;

    default:
      // Default to current month
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  return { start, end };
}

module.exports = router;
