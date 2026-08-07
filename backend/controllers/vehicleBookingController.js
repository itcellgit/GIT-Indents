const prisma = require('../prismaClient');

const mapVehicleBookingRow = (row) => ({
  id: Number(row.id),
  vehicle_id: Number(row.vehicle_id),
  vehicle_number: row.vehicle_number || '',
  vehicle_name: row.vehicle_name || '',
  vehicle_type: row.vehicle_type || '',
  booked_by: row.booked_by,
  purpose: row.purpose || '',
  destination: row.destination || '',
  travel_date: row.travel_date,
  start_time: row.start_time,
  expected_return_time: row.expected_return_time,
  passenger_count: row.passenger_count,
  status: 'PENDING',
  remarks: row.remarks || '',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const getVehicleBookings = async (req, res) => {
  try {
    const bookings = await prisma.$queryRawUnsafe(
      `SELECT vb.id, vb.vehicle_id, v.vehicle_number, v.vehicle_name, v.vehicle_type,
              vb.booked_by, vb.purpose, vb.destination, vb.travel_date, vb.start_time,
              vb.expected_return_time, vb.passenger_count, vb.remarks,
              vb.created_at, vb.updated_at
       FROM public.vehicle_bookings vb
       LEFT JOIN public.vehicles v ON v.id = vb.vehicle_id
       ORDER BY vb.travel_date DESC, vb.id DESC`
    );

    res.json({ success: true, bookings: bookings.map(mapVehicleBookingRow) });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const createVehicleBooking = async (req, res) => {
  try {
    const {
      vehicle_id,
      booked_by,
      purpose,
      destination,
      travel_date,
      start_time,
      expected_return_time,
      passenger_count,
      remarks,
    } = req.body;

    if (!vehicle_id) return res.status(400).json({ message: 'Vehicle is required' });
    if (!booked_by || !String(booked_by).trim()) return res.status(400).json({ message: 'Booked by is required' });
    if (!travel_date) return res.status(400).json({ message: 'Travel date is required' });

    const bookingRows = await prisma.$queryRawUnsafe(
      `INSERT INTO public.vehicle_bookings
       (vehicle_id, booked_by, purpose, destination, travel_date, start_time, expected_return_time, passenger_count, remarks, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING id, vehicle_id, booked_by, purpose, destination, travel_date, start_time, expected_return_time, passenger_count, remarks, created_at, updated_at`,
      Number(vehicle_id),
      String(booked_by).trim(),
      purpose ? String(purpose).trim() : null,
      destination ? String(destination).trim() : null,
      travel_date,
      start_time || null,
      expected_return_time || null,
      passenger_count ? Number(passenger_count) : null,
      remarks ? String(remarks).trim() : null
    );

    const booking = bookingRows[0];
    const joinedRows = await prisma.$queryRawUnsafe(
      `SELECT vb.id, vb.vehicle_id, v.vehicle_number, v.vehicle_name, v.vehicle_type,
              vb.booked_by, vb.purpose, vb.destination, vb.travel_date, vb.start_time,
              vb.expected_return_time, vb.passenger_count, vb.remarks,
              vb.created_at, vb.updated_at
       FROM public.vehicle_bookings vb
       LEFT JOIN public.vehicles v ON v.id = vb.vehicle_id
       WHERE vb.id = $1
       LIMIT 1`,
      booking.id
    );

    res.status(201).json({ success: true, booking: mapVehicleBookingRow(joinedRows[0]) });
  } catch (error) {
    console.error('Create vehicle booking failed:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const updateVehicleBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const bookingId = Number(id);
    const {
      vehicle_id,
      booked_by,
      purpose,
      destination,
      travel_date,
      start_time,
      expected_return_time,
      passenger_count,
      remarks,
    } = req.body;

    const existingRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM public.vehicle_bookings WHERE id = $1 LIMIT 1`,
      bookingId
    );

    if (!existingRows.length) {
      return res.status(404).json({ message: 'Vehicle booking not found' });
    }

    await prisma.$queryRawUnsafe(
      `UPDATE public.vehicle_bookings
       SET vehicle_id = COALESCE($2, vehicle_id),
           booked_by = COALESCE($3, booked_by),
           purpose = $4,
           destination = $5,
           travel_date = COALESCE($6, travel_date),
           start_time = $7,
           expected_return_time = $8,
           passenger_count = $9,
           remarks = $10,
           updated_at = NOW()
       WHERE id = $1`,
      bookingId,
      vehicle_id ? Number(vehicle_id) : null,
      booked_by ? String(booked_by).trim() : null,
      purpose ? String(purpose).trim() : null,
      destination ? String(destination).trim() : null,
      travel_date || null,
      start_time || null,
      expected_return_time || null,
      passenger_count === undefined || passenger_count === null || passenger_count === '' ? null : Number(passenger_count),
      remarks ? String(remarks).trim() : null
    );

    const joinedRows = await prisma.$queryRawUnsafe(
      `SELECT vb.id, vb.vehicle_id, v.vehicle_number, v.vehicle_name, v.vehicle_type,
              vb.booked_by, vb.purpose, vb.destination, vb.travel_date, vb.start_time,
              vb.expected_return_time, vb.passenger_count, vb.remarks,
              vb.created_at, vb.updated_at
       FROM public.vehicle_bookings vb
       LEFT JOIN public.vehicles v ON v.id = vb.vehicle_id
       WHERE vb.id = $1
       LIMIT 1`,
      bookingId
    );

    res.json({ success: true, booking: mapVehicleBookingRow(joinedRows[0]) });
  } catch (error) {
    console.error('Update vehicle booking failed:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const deleteVehicleBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const bookingId = Number(id);

    const existingRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM public.vehicle_bookings WHERE id = $1 LIMIT 1`,
      bookingId
    );

    if (!existingRows.length) {
      return res.status(404).json({ message: 'Vehicle booking not found' });
    }

    await prisma.$queryRawUnsafe(
      `DELETE FROM public.vehicle_bookings WHERE id = $1`,
      bookingId
    );

    res.json({ success: true, message: 'Vehicle booking deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getVehicleBookings,
  createVehicleBooking,
  updateVehicleBooking,
  deleteVehicleBooking,
};