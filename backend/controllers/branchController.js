const prisma = require('../prismaClient');

const mapBranchRow = (row) => ({
  id: Number(row.id),
  branch_name: row.branch_name || '',
  degree: row.degree || '',
  createdAt: row.created_at,
  updatedAt: row.Updated_at,
});

const getBranches = async (req, res) => {
  try {
    const branches = await prisma.$queryRawUnsafe(
      `SELECT id, branch_name, degree, created_at, "Updated_at"
       FROM public.branches
       ORDER BY branch_name ASC NULLS LAST, id ASC`
    );

    res.json({ success: true, branches: branches.map(mapBranchRow) });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const createBranch = async (req, res) => {
  try {
    const { branch_name, degree } = req.body;

    if (!branch_name || !String(branch_name).trim()) {
      return res.status(400).json({ message: 'Branch name is required' });
    }

    const name = String(branch_name).trim();

    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM public.branches WHERE LOWER(branch_name) = LOWER($1)`,
      name
    );
    if (existing && existing.length > 0) {
      return res.status(400).json({ message: 'A branch with this name already exists' });
    }

    const branchRows = await prisma.$queryRawUnsafe(
      `INSERT INTO public.branches (branch_name, degree, created_at, "Updated_at")
       VALUES ($1, $2, NOW(), NOW())
       RETURNING id, branch_name, degree, created_at, "Updated_at"`,
      name,
      degree ? String(degree).trim() : ''
    );

    res.status(201).json({ success: true, branch: mapBranchRow(branchRows[0]) });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const updateBranch = async (req, res) => {
  try {
    const { id } = req.params;
    const branchId = Number(id);
    const { branch_name, degree } = req.body;

    if (!branch_name || !String(branch_name).trim()) {
      return res.status(400).json({ message: 'Branch name is required' });
    }

    const name = String(branch_name).trim();

    const existingRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM public.branches WHERE id = $1 LIMIT 1`,
      branchId
    );

    if (!existingRows.length) {
      return res.status(404).json({ message: 'Branch not found' });
    }

    const duplicate = await prisma.$queryRawUnsafe(
      `SELECT id FROM public.branches WHERE LOWER(branch_name) = LOWER($1) AND id != $2`,
      name,
      branchId
    );
    if (duplicate && duplicate.length > 0) {
      return res.status(400).json({ message: 'A branch with this name already exists' });
    }

    const branchRows = await prisma.$queryRawUnsafe(
      `UPDATE public.branches
       SET branch_name = $2,
           degree = $3,
           "Updated_at" = NOW()
       WHERE id = $1
       RETURNING id, branch_name, degree, created_at, "Updated_at"`,
      branchId,
      name,
      degree ? String(degree).trim() : ''
    );

    res.json({ success: true, branch: mapBranchRow(branchRows[0]) });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const deleteBranch = async (req, res) => {
  try {
    const { id } = req.params;
    const branchId = Number(id);

    const existingRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM public.branches WHERE id = $1 LIMIT 1`,
      branchId
    );

    if (!existingRows.length) {
      return res.status(404).json({ message: 'Branch not found' });
    }

    await prisma.$queryRawUnsafe(
      `DELETE FROM public.branches WHERE id = $1`,
      branchId
    );

    res.json({ success: true, message: 'Branch deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getBranches,
  createBranch,
  updateBranch,
  deleteBranch,
};
