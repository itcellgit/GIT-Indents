const prisma = require('../prismaClient');
const { ROLES } = require('../utils/roles');
const { sendNotification, sendRoleNotification } = require('../utils/notificationService');

// status flow: Pending -> "HOD Approved" | "HOD Rejected" -> (grant recorded) -> Received
const STATUS = Object.freeze({
  PENDING: 'Pending',
  HOD_APPROVED: 'HOD Approved',
  HOD_REJECTED: 'HOD Rejected',
  RECEIVED: 'Received'
});

const mapIndentRow = (row) => ({
  id: Number(row.id),
  departmentId: row.department_id,
  reason: row.reason,
  status: row.status,
  hodRemark: row.hod_remark || '',
  hodReviewedAt: row.hod_reviewed_at || null,
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

// The HOD-review columns arrive with migration 28. Until it is applied the
// module still works (approve/reject just can't persist a remark) instead of
// 500ing every stationary read. Re-checks while absent so applying the
// migration later needs no restart.
let hodColumnsPresent = false;
const hodColumnsSupported = async () => {
  if (hodColumnsPresent) return true;
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'dept_stationary_indents'
         AND column_name = 'hod_remark'
       LIMIT 1`
    );
    hodColumnsPresent = rows.length > 0;
  } catch (error) {
    hodColumnsPresent = false;
  }
  return hodColumnsPresent;
};

const loadStationaryIndents = async (whereClause, params = []) => {
  const hodSelect = (await hodColumnsSupported())
    ? 'hod_remark, hod_reviewed_by, hod_reviewed_at,'
    : '';
  const indents = await prisma.$queryRawUnsafe(
    `SELECT id, department_id, reason, status, ${hodSelect} created_at, updated_at
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
  const raisedByNameById = departments.reduce((accumulator, department) => {
    accumulator[department.id] = department.name || '';
    return accumulator;
  }, {});

  const items = await prisma.$queryRawUnsafe(
    `SELECT id, dept_stationary_indent_id, stationary_id, request_quantity, request_date, grant_quantity, grant_date, created_at, updated_at
     FROM public.stationary_indent_and_grants
     WHERE dept_stationary_indent_id = ANY($1)
     ORDER BY id ASC`,
    indentIds
  );

  const stationaryIds = [...new Set(items.map((item) => Number(item.stationary_id)))];
  const stationaryNameById = {};
  if (stationaryIds.length) {
    const stationaries = await prisma.$queryRawUnsafe(
      `SELECT id, name FROM public.stationaries WHERE id = ANY($1)`,
      stationaryIds
    );
    stationaries.forEach((stationary) => {
      stationaryNameById[Number(stationary.id)] = stationary.name;
    });
  }

  const itemsByIndent = items.reduce((accumulator, item) => {
    const key = Number(item.dept_stationary_indent_id);
    if (!accumulator[key]) accumulator[key] = [];
    accumulator[key].push({
      ...mapItemRow(item),
      stationaryName: stationaryNameById[Number(item.stationary_id)] || null
    });
    return accumulator;
  }, {});

  return indents.map((indent) => ({
    ...mapIndentRow(indent),
    departmentName: departmentNameById[String(indent.department_id)] || String(indent.department_id),
    raisedByName: raisedByNameById[String(indent.department_id)] || '',
    items: itemsByIndent[Number(indent.id)] || []
  }));
};

const canAccessAllStationaryIndents = (userRole) =>
  userRole === ROLES.ADMIN || userRole === ROLES.OFFICE_STATIONARY;

// Best-effort: tell the department HOD(s) a new indent is waiting for approval.
const notifyDepartmentHods = async (department, senderId, indentId) => {
  try {
    const dept = String(department || '').trim();
    if (!dept) return;
    const hods = await prisma.$queryRawUnsafe(
      `SELECT u.id
       FROM public."User" u
       INNER JOIN public.user_roles ur ON ur.user_id = u.id
       INNER JOIN public.roles r ON r.id = ur.role_id
       WHERE r.role_name = $1 AND u."isActive" = true AND u.department = $2`,
      ROLES.HOD,
      dept
    );
    for (const hod of hods) {
      await sendNotification(
        hod.id,
        `A new stationary indent (#${indentId}) from your department is waiting for your approval.`,
        senderId
      );
    }
  } catch (error) {
    console.error('Stationary HOD notification failed:', error.message);
  }
};

const getStationaryIndents = async (req, res) => {
  try {
    const { role } = req.user;

    if (canAccessAllStationaryIndents(role)) {
      const indents = await loadStationaryIndents('', []);
      return res.json({ success: true, indents });
    }

    if (role === ROLES.HOD) {
      const department = String(req.user.department || '').trim();
      if (!department) {
        return res.json({ success: true, indents: [] });
      }
      const indents = await loadStationaryIndents(
        `WHERE department_id IN (SELECT id FROM public."User" WHERE department = $1)`,
        [department]
      );
      return res.json({ success: true, indents });
    }

    const indents = await loadStationaryIndents('WHERE department_id = $1', [req.user.id]);
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
        STATUS.PENDING
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

    await notifyDepartmentHods(req.user.department, req.user.id, Number(result.id));

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
      `SELECT id, department_id, status FROM public.dept_stationary_indents WHERE id = $1 LIMIT 1`,
      indentId
    );

    if (!existingIndent.length) {
      return res.status(404).json({ message: 'Stationary indent not found' });
    }

    const existing = existingIndent[0];
    const currentStatus = String(existing.status || STATUS.PENDING).trim();
    const canManageAll = canAccessAllStationaryIndents(req.user.role);
    const isOwner = existing.department_id === req.user.id;

    if (!canManageAll && !isOwner) {
      return res.status(403).json({ message: 'Not authorized to update this indent' });
    }

    if (items && (!Array.isArray(items) || items.length === 0)) {
      return res.status(400).json({ message: 'At least one item is required' });
    }

    const wantsReceived = status !== undefined && String(status).trim().toLowerCase() === STATUS.RECEIVED.toLowerCase();
    const wantsContentChange = reason !== undefined || Array.isArray(items);

    // Coordinator (the requester) may edit only while the indent is still Pending,
    // and may mark it Received only once a quantity has actually been granted.
    if (isOwner && !canManageAll) {
      if (wantsReceived) {
        if (currentStatus === STATUS.HOD_REJECTED) {
          return res.status(409).json({ message: 'This indent was rejected by the HOD.' });
        }
        const grantRows = await prisma.$queryRawUnsafe(
          `SELECT 1 FROM public.stationary_indent_and_grants
           WHERE dept_stationary_indent_id = $1 AND grant_quantity > 0 LIMIT 1`,
          indentId
        );
        if (!grantRows.length) {
          return res.status(409).json({ message: 'This indent cannot be marked as received before it has been granted.' });
        }
      } else if (wantsContentChange && currentStatus !== STATUS.PENDING) {
        return res.status(409).json({ message: 'This indent can no longer be edited.' });
      }
    }

    // Office_Stationary may record grant quantities only after the HOD has approved.
    if (req.user.role === ROLES.OFFICE_STATIONARY && Array.isArray(items)) {
      if (currentStatus === STATUS.PENDING) {
        return res.status(409).json({ message: 'This indent is awaiting HOD approval.' });
      }
      if (currentStatus === STATUS.HOD_REJECTED) {
        return res.status(409).json({ message: 'This indent was rejected by the HOD.' });
      }
    }

    // The only status transition allowed through this endpoint is -> Received,
    // by the requester (or an Admin). Approve/Reject go through the review route.
    let nextStatus;
    if (wantsReceived && (isOwner || req.user.role === ROLES.ADMIN)) {
      nextStatus = STATUS.RECEIVED;
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

      if (nextStatus !== undefined) {
        await tx.$queryRawUnsafe(
          `UPDATE public.dept_stationary_indents
           SET status = $2, updated_at = NOW()
           WHERE id = $1`,
          indentId,
          nextStatus
        );
      }

      if (Array.isArray(items)) {
        // Only Office_Stationary / Admin may set grant quantities. When the
        // requester edits their own indent, grant fields are forced to 0 so a
        // crafted payload can't self-grant and skip the HOD + Office steps.
        const canGrant = canManageAll;

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
            canGrant ? Number(item.grantQuantity || 0) : 0,
            canGrant ? toDateValue(item.grantDate) : null
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

// HOD (or Admin) approves or rejects a still-Pending department stationary indent.
const reviewStationaryIndent = async (req, res) => {
  try {
    const { id } = req.params;
    const indentId = Number(id);
    const action = String(req.body.action || '').trim().toLowerCase();
    const remark = String(req.body.remark || '').trim();

    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ message: 'action must be "approve" or "reject"' });
    }
    if (action === 'reject' && !remark) {
      return res.status(400).json({ message: 'A remark is required when rejecting an indent.' });
    }

    const rows = await prisma.$queryRawUnsafe(
      `SELECT i.id, i.department_id, i.status, u.department AS creator_department
       FROM public.dept_stationary_indents i
       LEFT JOIN public."User" u ON u.id = i.department_id
       WHERE i.id = $1 LIMIT 1`,
      indentId
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Stationary indent not found' });
    }

    const indent = rows[0];

    // A HOD can only review indents raised inside their own department.
    if (req.user.role === ROLES.HOD) {
      const hodDepartment = String(req.user.department || '').trim();
      const creatorDepartment = String(indent.creator_department || '').trim();
      if (!hodDepartment || hodDepartment !== creatorDepartment) {
        return res.status(403).json({ message: 'Not authorized to review this indent' });
      }
    }

    if (String(indent.status || STATUS.PENDING).trim() !== STATUS.PENDING) {
      return res.status(409).json({ message: 'This indent has already been reviewed.' });
    }

    const nextStatus = action === 'approve' ? STATUS.HOD_APPROVED : STATUS.HOD_REJECTED;

    if (await hodColumnsSupported()) {
      await prisma.$queryRawUnsafe(
        `UPDATE public.dept_stationary_indents
         SET status = $2, hod_remark = $3, hod_reviewed_by = $4, hod_reviewed_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        indentId,
        nextStatus,
        remark || null,
        req.user.id
      );
    } else {
      await prisma.$queryRawUnsafe(
        `UPDATE public.dept_stationary_indents
         SET status = $2, updated_at = NOW()
         WHERE id = $1`,
        indentId,
        nextStatus
      );
    }

    const indents = await loadStationaryIndents('WHERE id = $1', [indentId]);

    try {
      const creatorId = indent.department_id;
      if (action === 'approve') {
        await sendNotification(
          creatorId,
          `Your stationary indent (#${indentId}) has been approved by the HOD${remark ? `: ${remark}` : '.'}`,
          req.user.id
        );
        await sendRoleNotification({
          roleName: ROLES.OFFICE_STATIONARY,
          message: `Stationary indent #${indentId} has been approved by the HOD and is ready to be processed.`,
          subject: 'Stationary indent approved by HOD',
          senderId: req.user.id
        });
      } else {
        await sendNotification(
          creatorId,
          `Your stationary indent (#${indentId}) was rejected by the HOD: ${remark}`,
          req.user.id
        );
      }
    } catch (notifyError) {
      console.error('Stationary review notification failed:', notifyError.message);
    }

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
      `SELECT id, department_id, status FROM public.dept_stationary_indents WHERE id = $1 LIMIT 1`,
      indentId
    );

    if (!existingIndent.length) {
      return res.status(404).json({ message: 'Stationary indent not found' });
    }

    const existing = existingIndent[0];
    const canManageAll = canAccessAllStationaryIndents(req.user.role);
    const isOwner = existing.department_id === req.user.id;

    if (!canManageAll && !isOwner) {
      return res.status(403).json({ message: 'Not authorized to delete this indent' });
    }

    // Once a HOD has acted on it, keep the record for the audit trail.
    if (isOwner && !canManageAll && String(existing.status || STATUS.PENDING).trim() !== STATUS.PENDING) {
      return res.status(409).json({ message: 'This indent can no longer be deleted.' });
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
  reviewStationaryIndent,
  deleteStationaryIndent
};
