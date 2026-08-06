const prisma = require('../prismaClient');
const { ROLES } = require('../utils/roles');

const mapIndentRow = (row) => ({
  id: Number(row.id),
  departmentId: row.department_id,
  reason: row.reason,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const mapItemRow = (row) => ({
  id: Number(row.id),
  deptStationaryIndentId: Number(row.dept_stationary_indent_id),
  stationaryId: Number(row.stationary_id),
  requestQuantity: Number(row.request_quantity),
  requestDate: row.request_date,
  grantQuantity: Number(row.grant_quantity),
  grantDate: row.grant_date,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const toDateValue = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const loadStationaryIndents = async (whereClause, params = []) => {
  const indents = await prisma.$queryRawUnsafe(
    `SELECT id, department_id, reason, status, created_at, updated_at
     FROM public.dept_stationary_indents
     ${whereClause}
     ORDER BY created_at DESC NULLS LAST, id DESC`,
    ...params
  );

  if (!indents.length) return [];

  const indentIds = indents.map((indent) => Number(indent.id));
  const departmentIds = [...new Set(indents.map((indent) => String(indent.department_id)))];
  const departments = await prisma.user.findMany({
    where: { id: { in: departmentIds } },
    select: { id: true, department: true, name: true }
  });
  const departmentNameById = departments.reduce((accumulator, department) => {
    accumulator[department.id] = department.department || department.name;
    return accumulator;
  }, {});

  const items = await prisma.$queryRawUnsafe(
    `SELECT id, dept_stationary_indent_id, stationary_id, request_quantity, request_date, grant_quantity, grant_date, created_at, updated_at
     FROM public.stationary_indent_and_grants
     WHERE dept_stationary_indent_id = ANY($1)
     ORDER BY id ASC`,
    indentIds
  );

  const itemsByIndent = items.reduce((accumulator, item) => {
    const key = Number(item.dept_stationary_indent_id);
    if (!accumulator[key]) accumulator[key] = [];
    accumulator[key].push(mapItemRow(item));
    return accumulator;
  }, {});

  return indents.map((indent) => ({
    ...mapIndentRow(indent),
    departmentName: departmentNameById[String(indent.department_id)] || String(indent.department_id),
    items: itemsByIndent[Number(indent.id)] || []
  }));
};

const canAccessAllStationaryIndents = (userRole) =>
  userRole === ROLES.ADMIN || userRole === ROLES.OFFICE_STATIONARY;

const getStationaryIndents = async (req, res) => {
  try {
    const canViewAll = canAccessAllStationaryIndents(req.user.role);
    const indents = canViewAll
      ? await loadStationaryIndents('', [])
      : await loadStationaryIndents('WHERE department_id = $1', [req.user.id]);

    res.json({ success: true, indents });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const createStationaryIndent = async (req, res) => {
  try {
    const { reason, items, departmentId } = req.body;
    const effectiveDepartmentId = departmentId || req.user.id;

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ message: 'Reason is required' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'At least one item is required' });
    }

    const validItems = items.filter((item) => item.stationaryId && Number(item.requestQuantity) > 0);
    if (validItems.length === 0) {
      return res.status(400).json({ message: 'At least one valid item is required' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const indentRows = await tx.$queryRawUnsafe(
        `INSERT INTO public.dept_stationary_indents (department_id, reason, status, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING id, department_id, reason, status, created_at, updated_at`,
        effectiveDepartmentId,
        String(reason).trim(),
        'Pending'
      );

      const indent = indentRows[0];

      for (const item of validItems) {
        await tx.$queryRawUnsafe(
          `INSERT INTO public.stationary_indent_and_grants
           (dept_stationary_indent_id, stationary_id, request_quantity, request_date, grant_quantity, grant_date, created_at, updated_at)
           VALUES ($1, $2, $3, CURRENT_DATE, 0, NULL, NOW(), NOW())`,
          indent.id,
          item.stationaryId,
          Number(item.requestQuantity)
        );
      }

      return indent;
    });

    const indents = await loadStationaryIndents('WHERE id = $1', [Number(result.id)]);
    res.status(201).json({ success: true, indent: indents[0] });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const updateStationaryIndent = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, items, status } = req.body;
    const indentId = Number(id);

    const existingIndent = await prisma.$queryRawUnsafe(
      `SELECT id, department_id FROM public.dept_stationary_indents WHERE id = $1 LIMIT 1`,
      indentId
    );

    if (!existingIndent.length) {
      return res.status(404).json({ message: 'Stationary indent not found' });
    }

    const canManageAll = canAccessAllStationaryIndents(req.user.role);
    if (!canManageAll && existingIndent[0].department_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this indent' });
    }

    if (items && (!Array.isArray(items) || items.length === 0)) {
      return res.status(400).json({ message: 'At least one item is required' });
    }

    await prisma.$transaction(async (tx) => {
      if (reason !== undefined) {
        await tx.$queryRawUnsafe(
          `UPDATE public.dept_stationary_indents
           SET reason = $2, updated_at = NOW()
           WHERE id = $1`,
          indentId,
          String(reason).trim()
        );
      }

      if (status !== undefined) {
        await tx.$queryRawUnsafe(
          `UPDATE public.dept_stationary_indents
           SET status = $2, updated_at = NOW()
           WHERE id = $1`,
          indentId,
          String(status).trim()
        );
      }

      if (Array.isArray(items)) {
        await tx.$queryRawUnsafe(
          `DELETE FROM public.stationary_indent_and_grants WHERE dept_stationary_indent_id = $1`,
          indentId
        );

        for (const item of items.filter((entry) => entry.stationaryId && Number(entry.requestQuantity) > 0)) {
          await tx.$queryRawUnsafe(
            `INSERT INTO public.stationary_indent_and_grants
             (dept_stationary_indent_id, stationary_id, request_quantity, request_date, grant_quantity, grant_date, created_at, updated_at)
             VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, NOW(), NOW())`,
            indentId,
            item.stationaryId,
            Number(item.requestQuantity),
            Number(item.grantQuantity || 0),
            toDateValue(item.grantDate)
          );
        }
      }
    });

    const indents = await loadStationaryIndents('WHERE id = $1', [indentId]);
    res.json({ success: true, indent: indents[0] });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const deleteStationaryIndent = async (req, res) => {
  try {
    const { id } = req.params;
    const indentId = Number(id);

    const existingIndent = await prisma.$queryRawUnsafe(
      `SELECT id, department_id FROM public.dept_stationary_indents WHERE id = $1 LIMIT 1`,
      indentId
    );

    if (!existingIndent.length) {
      return res.status(404).json({ message: 'Stationary indent not found' });
    }

    const canManageAll = canAccessAllStationaryIndents(req.user.role);
    if (!canManageAll && existingIndent[0].department_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this indent' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        `DELETE FROM public.stationary_indent_and_grants WHERE dept_stationary_indent_id = $1`,
        indentId
      );
      await tx.$queryRawUnsafe(
        `DELETE FROM public.dept_stationary_indents WHERE id = $1`,
        indentId
      );
    });

    res.json({ success: true, message: 'Stationary indent deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getStationaryIndents,
  createStationaryIndent,
  updateStationaryIndent,
  deleteStationaryIndent
};