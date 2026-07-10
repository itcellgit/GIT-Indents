// backend/controllers/adminController.js
const prisma = require('../prismaClient');
const bcrypt = require('bcryptjs');

const normalizeRole = (role) => {
  if (!role) return 'Faculty';
  const roleMap = {
    'admin': 'Admin',
    'principal': 'Principal',
    'hod': 'HOD',
    'faculty': 'Faculty',
    'non-teaching': 'Non-Teaching',
    'non teaching': 'Non-Teaching',
    'nonteaching': 'Non-Teaching'
  };
  return roleMap[role.toLowerCase().trim()] || 'Faculty';
};

// @desc    Get system-wide statistics for the admin dashboard
// @route   GET /api/admin/stats
// @access  Private/Admin
const getSystemStats = async (req, res) => {
  try {
    console.log("Fetching system stats for admin...");
    const totalDepartments = await prisma.category.count();
    const totalUsers = await prisma.user.count();
    
    // Active: Not Completed and not Rejected
    const activeComplaints = await prisma.indent.count({ 
      where: { 
        status: { 
          notIn: ['Completed', 'Rejected by Dept HOD', 'Rejected by Maintenance HOD', 'Rejected by Principal'] 
        } 
      }
    });
    
    // Resolved: Completed
    const resolvedComplaints = await prisma.indent.count({ 
      where: { status: 'Completed' }
    });

    console.log("Stats found:", { totalDepartments, totalUsers, activeComplaints, resolvedComplaints });

    res.json({
      success: true,
      stats: {
        totalDepartments,
        totalUsers,
        activeComplaints,
        resolvedComplaints
      }
    });
  } catch (err) {
    console.error("Error in getSystemStats:", err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get all users (for Admin User Management)
// @route   GET /api/admin/users
// @access  Private/Admin
const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        isActive: true,
        createdAt: true
      }
    });
    
    res.json({ 
      success: true,
      users 
    });
  } catch (err) {
    console.error("Error in getAllUsers:", err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create user (by Admin)
// @route   POST /api/admin/users
// @access  Private/Admin
const createUser = async (req, res) => {
  try {
    const { name, email, password, department, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    const userExists = await prisma.user.findUnique({ where: { email } });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        department: department || '',
        role: normalizeRole(role),
        isActive: true
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        isActive: true,
        createdAt: true
      }
    });

    res.status(201).json({ success: true, user });
  } catch (err) {
    console.error("Error in createUser:", err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Bulk create users (by Admin)
// @route   POST /api/admin/users/bulk
// @access  Private/Admin
const bulkCreateUsers = async (req, res) => {
  try {
    const { users } = req.body;

    if (!users || !Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ message: 'Valid users array is required' });
    }

    const defaultPassword = 'password@123';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(defaultPassword, salt);

    const formattedUsers = users.map(user => ({
      name: user.Name || user.name,
      email: user.Email || user.email,
      department: user.Department || user.department || '',
      role: normalizeRole(user.Role || user.role),
      password: hashedPassword,
      isActive: true
    }));

    // Filter out invalid users
    const validUsers = formattedUsers.filter(u => u.name && u.email);

    if (validUsers.length === 0) {
      return res.status(400).json({ message: 'No valid user data found in the upload' });
    }

    const result = await prisma.user.createMany({
      data: validUsers,
      skipDuplicates: true, // Will skip users if email already exists
    });

    res.status(201).json({ 
      success: true, 
      message: `Successfully added ${result.count} users. Any existing emails were skipped.`
    });
  } catch (err) {
    console.error("Error in bulkCreateUsers:", err);
    res.status(500).json({ message: 'Server Error during bulk upload' });
  }
};

// @desc    Get all complaints/indents (for Admin Monitoring)
// @route   GET /api/admin/complaints
// @access  Private/Admin
const getAllComplaints = async (req, res) => {
  try {
    const indents = await prisma.indent.findMany({
      include: {
        requester: { select: { name: true } },
        category: { select: { name: true } },
        statusHistory: { orderBy: { timestamp: 'asc' } },
        materialsUsed: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ 
      success: true,
      complaints: indents 
    });
  } catch (err) {
    console.error("Error in getAllComplaints:", err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create a new maintenance department (Category)
// @route   POST /api/admin/departments
// @access  Private/Admin
const createDepartment = async (req, res) => {
  try {
    const { name, description, inchargeEmail } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Department name is required' });
    }

    let inchargeId = null;
    
    // If an incharge email is provided, verify they exist and are Faculty/HOD
    if (inchargeEmail) {
      const user = await prisma.user.findUnique({ where: { email: inchargeEmail } });
      if (!user) {
        return res.status(404).json({ message: 'User with this email not found' });
      }
      if (user.role !== 'Faculty' && user.role !== 'HOD' && user.role !== 'Non-Teaching') {
        return res.status(400).json({ message: 'Assigned incharge must be Faculty, Non-Teaching, or HOD' });
      }

      // Upgrade Faculty/Non-Teaching to HOD role if they are made an incharge
      if (user.role === 'Faculty' || user.role === 'Non-Teaching') {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: 'HOD' }
        });
      }

      inchargeId = user.id;
    }

    // Check if category already exists
    const categoryExists = await prisma.category.findUnique({ where: { name } });
    if (categoryExists) {
      return res.status(400).json({ message: 'Department already exists' });
    }

    const category = await prisma.category.create({
      data: {
        name,
        description,
        inchargeId
      },
      include: {
        incharge: { select: { name: true, email: true, role: true } }
      }
    });

    res.status(201).json({
      success: true,
      department: category
    });
  } catch (err) {
    console.error("Error in createDepartment:", err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update a maintenance department (Category)
// @route   PUT /api/admin/departments/:id
// @access  Private/Admin
const updateDepartment = async (req, res) => {
  try {
    const { name, description, inchargeEmail } = req.body;
    const { id } = req.params;

    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
      return res.status(404).json({ message: 'Department not found' });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    // Handle incharge update
    if (inchargeEmail !== undefined) {
      if (!inchargeEmail) {
        updateData.inchargeId = null;
      } else {
        const user = await prisma.user.findUnique({ where: { email: inchargeEmail } });
        if (!user) {
          return res.status(404).json({ message: 'User with this email not found' });
        }
        if (user.role !== 'Faculty' && user.role !== 'HOD' && user.role !== 'Non-Teaching') {
          return res.status(400).json({ message: 'Assigned incharge must be Faculty, Non-Teaching, or HOD' });
        }

        // Upgrade Faculty/Non-Teaching to HOD role if they are made an incharge
        if (user.role === 'Faculty' || user.role === 'Non-Teaching') {
          await prisma.user.update({
            where: { id: user.id },
            data: { role: 'HOD' }
          });
        }

        updateData.inchargeId = user.id;
      }
    }

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: updateData,
      include: {
        incharge: { select: { name: true, email: true, role: true } }
      }
    });
    
    res.json({
      success: true,
      department: updatedCategory
    });
  } catch (err) {
    console.error("Error in updateDepartment:", err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Search for users by email (For assigning HODs/Incharge)
// @route   GET /api/admin/users/search?email=...
// @access  Private/Admin
const searchUsers = async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ message: 'Email query parameter is required' });
    }

    const users = await prisma.user.findMany({ 
      where: {
        email: { contains: email, mode: 'insensitive' },
        role: { in: ['Faculty', 'HOD', 'Non-Teaching'] }
      },
      select: { id: true, name: true, email: true, role: true }
    });

    res.json({ users });
  } catch (err) {
    console.error("Error in searchUsers:", err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get all Departments/Categories (Admin View)
// @route   GET /api/admin/departments
// @access  Private/Admin
const getDepartmentsAdmin = async (req, res) => {
  try {
    const departments = await prisma.category.findMany({
      include: {
        incharge: { select: { name: true, email: true, role: true } }
      }
    });
    res.json({ departments });
  } catch (err) {
    console.error("Error in getDepartmentsAdmin:", err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get data for monthly report
// @route   GET /api/admin/reports
// @access  Private/Admin
const getMonthlyReport = async (req, res) => {
  try {
    const { months, years, departments, statuses, month, year, status } = req.query;

    const query = {};

    // Note: Prisma does not have $expr $month natively inside findMany where clause easily without raw queries.
    // Instead of raw query, let's fetch all (or filter by indexable fields) and filter in memory, or use raw if needed.
    // Given the previous code, let's construct native where clauses for status and department
    
    const statusesArr = statuses ? statuses.split(',').filter(Boolean) : (status && status !== 'All' ? [status] : null);
    if (statusesArr && statusesArr.length > 0 && !statusesArr.includes('All')) {
      query.status = { in: statusesArr };
    }

    const deptsArr = departments ? departments.split(',').filter(Boolean) : null;
    if (deptsArr && deptsArr.length > 0 && !deptsArr.includes('All')) {
      query.categoryId = { in: deptsArr };
    }

    const indents = await prisma.indent.findMany({
      where: query,
      include: {
        requester: { select: { name: true } },
        category: { select: { name: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Handle months and years filtering in JS
    const monthsArr = months ? months.split(',').map(Number) : (month ? [parseInt(month)] : null);
    const yearsArr = years ? years.split(',').map(Number) : (year ? [parseInt(year)] : null);

    let filteredIndents = indents;
    if (monthsArr || yearsArr) {
      filteredIndents = indents.filter(i => {
        const date = new Date(i.createdAt);
        const m = date.getMonth() + 1; // 1-12
        const y = date.getFullYear();
        let match = true;
        if (monthsArr && monthsArr.length > 0 && !monthsArr.includes(m)) match = false;
        if (yearsArr && yearsArr.length > 0 && !yearsArr.includes(y)) match = false;
        return match;
      });
    }

    const reportData = filteredIndents.map(i => ({
      indentNumber: i.indentNumber || i.id.substring(0, 8),
      date: new Date(i.createdAt).toLocaleDateString(),
      generatedBy: i.requester?.name || 'N/A',
      assignedToDept: i.category?.name || 'Unassigned',
      status: i.status,
      description: i.description || 'No description'
    }));

    res.json({ success: true, reportData });
  } catch (err) {
    console.error("Error in getMonthlyReport:", err);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Toggle user active status
// @route   PUT /api/admin/users/:id/status
// @access  Private/Admin
const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Prevent admin from disabling themselves
    if (user.role === 'Admin' && req.user && req.user.id === id) {
      return res.status(400).json({ message: 'Cannot disable your own admin account' });
    }
    
    const newStatus = !user.isActive;
    
    await prisma.user.update({
      where: { id },
      data: { isActive: newStatus }
    });
    
    res.json({ success: true, isActive: newStatus, message: `User ${newStatus ? 'enabled' : 'disabled'} successfully` });
  } catch (err) {
    console.error("Error in toggleUserStatus:", err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getSystemStats,
  getAllUsers,
  createUser,
  getAllComplaints,
  createDepartment,
  updateDepartment,
  searchUsers,
  getDepartmentsAdmin,
  getMonthlyReport,
  toggleUserStatus,
  bulkCreateUsers
};
