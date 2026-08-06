const prisma = require('../prismaClient');

const mapHallRow = (row) => ({
  id: Number(row.id),
  name: row.name,
  location: row.location || '',
  status: row.status === 'ACTIVE' ? 'Active' : row.status === 'INACTIVE' ? 'Inactive' : row.status || 'Active',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const normalizeStatus = (status) => {
  const value = String(status || '').trim().toLowerCase();
  if (!value) return 'Active';
  if (value === 'active') return 'Active';
  if (value === 'inactive') return 'Inactive';
  return status;
};

const getHalls = async (req, res) => {
  try {
    const halls = await prisma.$queryRawUnsafe(
      `SELECT id, name, location, status, created_at, updated_at
       FROM public.halls
       ORDER BY created_at DESC NULLS LAST, id DESC`
    );

    res.json({ success: true, halls: halls.map(mapHallRow) });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const createHall = async (req, res) => {
  try {
    const { name, location, status } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const hallRows = await prisma.$queryRawUnsafe(
      `INSERT INTO public.halls (name, location, status, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING id, name, location, status, created_at, updated_at`,
      String(name).trim(),
      location ? String(location).trim() : null,
      normalizeStatus(status)
    );

    res.status(201).json({ success: true, hall: mapHallRow(hallRows[0]) });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const updateHall = async (req, res) => {
  try {
    const { id } = req.params;
    const hallId = Number(id);
    const { name, location, status } = req.body;

    const existingRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM public.halls WHERE id = $1 LIMIT 1`,
      hallId
    );

    if (!existingRows.length) {
      return res.status(404).json({ message: 'Hall not found' });
    }

    const hallRows = await prisma.$queryRawUnsafe(
      `UPDATE public.halls
       SET name = COALESCE($2, name),
           location = $3,
           status = COALESCE($4, status),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, location, status, created_at, updated_at`,
      hallId,
      name && String(name).trim() ? String(name).trim() : null,
      location === undefined ? null : (location === null ? null : String(location).trim()),
      status ? normalizeStatus(status) : null
    );

    res.json({ success: true, hall: mapHallRow(hallRows[0]) });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const deleteHall = async (req, res) => {
  try {
    const { id } = req.params;
    const hallId = Number(id);

    const existingRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM public.halls WHERE id = $1 LIMIT 1`,
      hallId
    );

    if (!existingRows.length) {
      return res.status(404).json({ message: 'Hall not found' });
    }

    await prisma.$queryRawUnsafe(
      `DELETE FROM public.halls WHERE id = $1`,
      hallId
    );

    res.json({ success: true, message: 'Hall deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getHalls,
  createHall,
  updateHall,
  deleteHall,
};