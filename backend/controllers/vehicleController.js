const prisma = require('../prismaClient');

const mapVehicleRow = (row) => ({
  id: Number(row.id),
  vehicle_number: row.vehicle_number,
  vehicle_name: row.vehicle_name || '',
  vehicle_type: row.vehicle_type || '',
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

const getVehicles = async (req, res) => {
  try {
    const vehicles = await prisma.$queryRawUnsafe(
      `SELECT id, vehicle_number, vehicle_name, vehicle_type, status, created_at, updated_at
       FROM public.vehicles
       ORDER BY created_at DESC NULLS LAST, id DESC`
    );

    res.json({ success: true, vehicles: vehicles.map(mapVehicleRow) });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const createVehicle = async (req, res) => {
  try {
    const { vehicle_number, vehicle_name, vehicle_type, status } = req.body;

    if (!vehicle_number || !String(vehicle_number).trim()) {
      return res.status(400).json({ message: 'Vehicle number is required' });
    }

    const vehicleRows = await prisma.$queryRawUnsafe(
      `INSERT INTO public.vehicles (vehicle_number, vehicle_name, vehicle_type, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, vehicle_number, vehicle_name, vehicle_type, status, created_at, updated_at`,
      String(vehicle_number).trim(),
      vehicle_name ? String(vehicle_name).trim() : null,
      vehicle_type ? String(vehicle_type).trim() : null,
      normalizeStatus(status)
    );

    res.status(201).json({ success: true, vehicle: mapVehicleRow(vehicleRows[0]) });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const updateVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    const vehicleId = Number(id);
    const { vehicle_number, vehicle_name, vehicle_type, status } = req.body;

    const existingRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM public.vehicles WHERE id = $1 LIMIT 1`,
      vehicleId
    );

    if (!existingRows.length) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    const vehicleRows = await prisma.$queryRawUnsafe(
      `UPDATE public.vehicles
       SET vehicle_number = COALESCE($2, vehicle_number),
           vehicle_name = $3,
           vehicle_type = $4,
           status = COALESCE($5, status),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, vehicle_number, vehicle_name, vehicle_type, status, created_at, updated_at`,
      vehicleId,
      vehicle_number && String(vehicle_number).trim() ? String(vehicle_number).trim() : null,
      vehicle_name === undefined ? null : (vehicle_name === null ? null : String(vehicle_name).trim()),
      vehicle_type === undefined ? null : (vehicle_type === null ? null : String(vehicle_type).trim()),
      status ? normalizeStatus(status) : null
    );

    res.json({ success: true, vehicle: mapVehicleRow(vehicleRows[0]) });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const deleteVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    const vehicleId = Number(id);

    const existingRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM public.vehicles WHERE id = $1 LIMIT 1`,
      vehicleId
    );

    if (!existingRows.length) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    await prisma.$queryRawUnsafe(
      `DELETE FROM public.vehicles WHERE id = $1`,
      vehicleId
    );

    res.json({ success: true, message: 'Vehicle deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
};