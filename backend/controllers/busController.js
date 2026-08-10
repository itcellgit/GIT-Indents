const prisma = require('../prismaClient');

const mapBusRow = (row) => ({
  id: Number(row.id),
  bus_number: row.bus_number,
  bus_name: row.bus_name || '',
  bus_type: row.bus_type || '',
  status: row.status === 'AVAILABLE' ? 'Available' : row.status === 'UNAVAILABLE' ? 'Unavailable' : row.status || 'Available',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const normalizeStatus = (status) => {
  const value = String(status || '').trim().toLowerCase();
  if (!value) return 'Available';
  if (value === 'available') return 'Available';
  if (value === 'unavailable') return 'Unavailable';
  return status;
};

const getBuses = async (req, res) => {
  try {
    const buses = await prisma.$queryRawUnsafe(
      `SELECT id, bus_number, bus_name, bus_type, status, created_at, updated_at
       FROM public.buses
       ORDER BY created_at DESC NULLS LAST, id DESC`
    );

    res.json({ success: true, buses: buses.map(mapBusRow) });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const createBus = async (req, res) => {
  try {
    const { bus_number, bus_name, bus_type, status } = req.body;

    if (!bus_number || !String(bus_number).trim()) {
      return res.status(400).json({ message: 'Bus number is required' });
    }

    const busRows = await prisma.$queryRawUnsafe(
      `INSERT INTO public.buses (bus_number, bus_name, bus_type, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, bus_number, bus_name, bus_type, status, created_at, updated_at`,
      String(bus_number).trim(),
      bus_name ? String(bus_name).trim() : null,
      bus_type ? String(bus_type).trim() : null,
      normalizeStatus(status)
    );

    res.status(201).json({ success: true, bus: mapBusRow(busRows[0]) });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const updateBus = async (req, res) => {
  try {
    const { id } = req.params;
    const busId = Number(id);
    const { bus_number, bus_name, bus_type, status } = req.body;

    const existingRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM public.buses WHERE id = $1 LIMIT 1`,
      busId
    );

    if (!existingRows.length) {
      return res.status(404).json({ message: 'Bus not found' });
    }

    const busRows = await prisma.$queryRawUnsafe(
      `UPDATE public.buses
       SET bus_number = COALESCE($2, bus_number),
           bus_name = $3,
           bus_type = $4,
           status = COALESCE($5, status),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, bus_number, bus_name, bus_type, status, created_at, updated_at`,
      busId,
      bus_number && String(bus_number).trim() ? String(bus_number).trim() : null,
      bus_name === undefined ? null : (bus_name === null ? null : String(bus_name).trim()),
      bus_type === undefined ? null : (bus_type === null ? null : String(bus_type).trim()),
      status ? normalizeStatus(status) : null
    );

    res.json({ success: true, bus: mapBusRow(busRows[0]) });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const deleteBus = async (req, res) => {
  try {
    const { id } = req.params;
    const busId = Number(id);

    const existingRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM public.buses WHERE id = $1 LIMIT 1`,
      busId
    );

    if (!existingRows.length) {
      return res.status(404).json({ message: 'Bus not found' });
    }

    await prisma.$queryRawUnsafe(
      `DELETE FROM public.buses WHERE id = $1`,
      busId
    );

    res.json({ success: true, message: 'Bus deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getBuses,
  createBus,
  updateBus,
  deleteBus,
};
