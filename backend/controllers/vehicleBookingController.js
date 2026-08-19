const prisma = require('../prismaClient');
const { sendEmailNotificationToRecipients, escapeHtml, formatEmailDate, formatEmailTime } = require('../utils/notificationService');
const { ROLES } = require('../utils/roles');

const VEHICLE_BOOKING_EMAILS = [];

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

const BOOKING_PERIOD_LABELS = {
  MORNING: 'Morning',
  SECOND_HALF: 'Second Half',
  FULL_DAY: 'Full Day',
  CUSTOM: 'Custom',
};
const humanizeBookingPeriod = (period) => BOOKING_PERIOD_LABELS[period] || period || 'N/A';

const mapVehicleBookingRow = (row) => ({
  id: Number(row.id),
  vehicle_id: row.vehicle_id === null || row.vehicle_id === undefined ? null : Number(row.vehicle_id),
  vehicle_number: row.vehicle_number || '',
  vehicle_name: row.vehicle_name || '',
  vehicle_type: row.vehicle_type || '',
  driver_id: row.driver_id || null,
  driver_name: row.driver_name || '',
  driver_phone_no: row.driver_phone_no || '',
  booked_by: row.booked_by,
  booked_by_name: row.booked_by_name || '',
  booked_by_email: row.booked_by_email || '',
  purpose: row.purpose || '',
  destination: row.destination || '',
  start_date: row.start_date,
  end_date: row.end_date,
  booking_period: row.booking_period || 'FULL_DAY',
  start_time: row.start_time,
  end_time: row.end_time,
  passenger_count: row.passenger_count,
  status: row.status || 'PENDING',
  approved_by: row.approved_by || '',
  approved_at: row.approved_at || null,
  remarks: row.remarks || '',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toLocalDateTime = (value) => {
  if (!value) return null;
  const date = new Date(value);
  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// A vehicle booking "holds" its slot while PENDING or APPROVED; REJECTED/CANCELLED
// bookings never block a new request for the same slot. No vehicle assigned yet
// (vehicleId null) means nothing to conflict against.
const findVehicleBookingConflict = async (vehicleId, startDate, endDate, startTime, endTime, excludeId = null) => {
  if (!vehicleId) return null;
  const rows = await prisma.$queryRawUnsafe(
    `SELECT vb.id, vb.purpose, vb.start_date, vb.end_date, u.name AS booked_by_name
     FROM public.vehicle_bookings vb
     LEFT JOIN public."User" u ON u.id = vb.booked_by
     WHERE vb.vehicle_id = $1
       AND vb.status IN ('PENDING', 'APPROVED')
       AND ($6::bigint IS NULL OR vb.id <> $6)
       AND (vb.start_date + vb.start_time) < ($3::date + $5::time)
       AND (vb.end_date + vb.end_time) > ($2::date + $4::time)
     ORDER BY vb.start_date ASC, vb.start_time ASC
     LIMIT 1`,
    vehicleId,
    startDate,
    endDate,
    startTime,
    endTime,
    excludeId
  );
  return rows[0] || null;
};

const conflictMessage = (conflict, resourceLabel) =>
  `${resourceLabel} is already booked for the requested time (conflicts with a booking by ${conflict.booked_by_name || 'another user'}).`;

const fetchVehicleBookingById = async (bookingId) => {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT vb.id, vb.vehicle_id, v.vehicle_number, v.vehicle_name, v.vehicle_type,
            vb.driver_id, du.name AS driver_name, du.staff_phone_no AS driver_phone_no,
            vb.booked_by, u.name AS booked_by_name, u.email AS booked_by_email, vb.purpose, vb.destination, vb.start_date, vb.end_date, vb.booking_period, vb.start_time, vb.end_time,
            vb.passenger_count, vb.status, vb.approved_by, vb.approved_at, vb.remarks,
            vb.created_at, vb.updated_at
     FROM public.vehicle_bookings vb
     LEFT JOIN public.vehicles v ON v.id = vb.vehicle_id
     LEFT JOIN "Driver" d ON d.id = vb.driver_id
     LEFT JOIN "User" du ON du.id = d."userId"
     LEFT JOIN public."User" u ON u.id = vb.booked_by
     WHERE vb.id = $1
     LIMIT 1`,
    bookingId
  );
  return rows;
};

const getVehicleBookings = async (req, res) => {
  try {
    const bookings = await prisma.$queryRawUnsafe(
      `SELECT vb.id, vb.vehicle_id, v.vehicle_number, v.vehicle_name, v.vehicle_type,
            vb.driver_id, du.name AS driver_name, du.staff_phone_no AS driver_phone_no,
              vb.booked_by, u.name AS booked_by_name, u.email AS booked_by_email, vb.purpose, vb.destination, vb.start_date, vb.end_date, vb.booking_period, vb.start_time, vb.end_time,
              vb.passenger_count, vb.status, vb.approved_by, vb.approved_at, vb.remarks,
              vb.created_at, vb.updated_at
         FROM public.vehicle_bookings vb
         LEFT JOIN public.vehicles v ON v.id = vb.vehicle_id
         LEFT JOIN "Driver" d ON d.id = vb.driver_id
         LEFT JOIN "User" du ON du.id = d."userId"
         LEFT JOIN public."User" u ON u.id = vb.booked_by
         ORDER BY vb.start_date DESC, vb.id DESC`
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
      driver_id,
      booked_by,
      purpose,
      destination,
      start_date,
      end_date,
      booking_period,
      start_time,
      end_time,
      passenger_count,
      remarks,
    } = req.body;

    if (!booked_by || !String(booked_by).trim()) {
      return res.status(400).json({ message: 'Booked by is required' });
    }

    if (!isValidEmail(req.body.booked_by_email)) {
      return res.status(400).json({ message: 'A valid booked-by email is required' });
    }

    if (!start_date) {
      return res.status(400).json({ message: 'Start date is required' });
    }

    const conflict = await findVehicleBookingConflict(
      vehicle_id ? Number(vehicle_id) : null,
      start_date,
      end_date || start_date,
      start_time || '00:00',
      end_time || '23:59:59',
    );
    if (conflict) {
      return res.status(409).json({ message: conflictMessage(conflict, 'This vehicle') });
    }

    const bookingRows = await prisma.$queryRawUnsafe(
      `INSERT INTO public.vehicle_bookings
        (vehicle_id, driver_id, booked_by, booked_by_email, purpose, destination, start_date, end_date, booking_period, start_time, end_time, passenger_count, remarks, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'PENDING', NOW(), NOW())
       RETURNING id, vehicle_id, booked_by, booked_by_email, purpose, destination, start_date, end_date, booking_period, start_time, end_time, passenger_count, remarks, status, created_at, updated_at`,
      vehicle_id ? Number(vehicle_id) : null,
      driver_id ? String(driver_id).trim() : null,
      String(booked_by).trim(),
      String(req.body.booked_by_email).trim().toLowerCase(),
      purpose ? String(purpose).trim() : null,
      destination ? String(destination).trim() : null,
      start_date,
      end_date || start_date,
      booking_period || 'FULL_DAY',
      start_time || null,
      end_time || null,
      passenger_count ? Number(passenger_count) : null,
      remarks ? String(remarks).trim() : null
    );

    const createdBookingRows = await prisma.$queryRawUnsafe(
      `SELECT vb.id, vb.vehicle_id, v.vehicle_number, v.vehicle_name, v.vehicle_type,
            vb.driver_id, du.name AS driver_name, du.staff_phone_no AS driver_phone_no,
              vb.booked_by, u.name AS booked_by_name, u.email AS booked_by_email, vb.purpose, vb.destination, vb.start_date, vb.end_date, vb.booking_period, vb.start_time, vb.end_time,
              vb.passenger_count, vb.status, vb.approved_by, vb.approved_at, vb.remarks,
              vb.created_at, vb.updated_at
         FROM public.vehicle_bookings vb
         LEFT JOIN public.vehicles v ON v.id = vb.vehicle_id
         LEFT JOIN "Driver" d ON d.id = vb.driver_id
         LEFT JOIN "User" du ON du.id = d."userId"
         LEFT JOIN public."User" u ON u.id = vb.booked_by
         WHERE vb.id = $1
         LIMIT 1`,
      Number(bookingRows[0].id)
    );

    const createdBooking = mapVehicleBookingRow(createdBookingRows[0] || bookingRows[0]);

    res.status(201).json({ success: true, booking: createdBooking });
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
      driver_id,
      booked_by,
      booked_by_email,
      purpose,
      destination,
      start_date,
      end_date,
      booking_period,
      start_time,
      end_time,
      passenger_count,
      remarks,
      status,
      approved_by,
    } = req.body;

    const beforeRows = await prisma.$queryRawUnsafe(
      `SELECT vb.status, vb.booked_by, vb.vehicle_id, vb.start_date, vb.end_date, vb.start_time, vb.end_time, u.department AS booked_by_department
       FROM public.vehicle_bookings vb
       LEFT JOIN public."User" u ON u.id = vb.booked_by
       WHERE vb.id = $1 LIMIT 1`,
      bookingId
    );

    if (!beforeRows.length) {
      return res.status(404).json({ message: 'Vehicle booking not found' });
    }

    const previousStatus = (beforeRows[0].status || 'PENDING').toUpperCase();
    const normalizedStatus = status ? String(status).trim().toUpperCase() : null;
    const approverId = String(req.user?.id || '').trim();

    const userRole = req.user?.role;
    const isManagementRole = userRole === ROLES.ADMIN || userRole === ROLES.RECEPTIONIST;

    if (!isManagementRole) {
      const isOwnBooking = beforeRows[0].booked_by === req.user?.id;
      const sameDepartment = Boolean(req.user?.department) &&
        Boolean(beforeRows[0].booked_by_department) &&
        req.user.department === beforeRows[0].booked_by_department;

      if (!isOwnBooking && !sameDepartment) {
        return res.status(403).json({ message: 'You are not authorized to modify this booking.' });
      }
    }

    const allowedStatusesForUser = isManagementRole
      ? ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']
      : ['PENDING', 'CANCELLED'];

    if (normalizedStatus && !allowedStatusesForUser.includes(normalizedStatus)) {
      return res.status(403).json({ message: `Your role cannot set status to ${normalizedStatus}` });
    }

    const effectiveStatus = normalizedStatus || previousStatus;
    if (['PENDING', 'APPROVED'].includes(effectiveStatus)) {
      const effectiveVehicleId = vehicle_id ? Number(vehicle_id) : beforeRows[0].vehicle_id;
      const effectiveStartDate = start_date || beforeRows[0].start_date;
      const effectiveEndDate = end_date || beforeRows[0].end_date;
      const effectiveStartTime = start_time || beforeRows[0].start_time;
      const effectiveEndTime = end_time || beforeRows[0].end_time;

      const conflict = await findVehicleBookingConflict(
        effectiveVehicleId,
        effectiveStartDate,
        effectiveEndDate,
        effectiveStartTime,
        effectiveEndTime,
        bookingId
      );
      if (conflict) {
        return res.status(409).json({ message: conflictMessage(conflict, 'This vehicle') });
      }
    }

    if (booked_by_email && !isValidEmail(booked_by_email)) {
      return res.status(400).json({ message: 'Invalid booked-by email format' });
    }

    await prisma.$queryRawUnsafe(
      `UPDATE public.vehicle_bookings
         SET vehicle_id = COALESCE($2, vehicle_id),
             driver_id = COALESCE($3, driver_id),
             booked_by = COALESCE($4, booked_by),
             booked_by_email = COALESCE($5, booked_by_email),
             purpose = $6,
             destination = $7,
             start_date = COALESCE($8, start_date),
             end_date = COALESCE($9, end_date),
             booking_period = COALESCE($10, booking_period),
             start_time = $11,
             end_time = $12,
             passenger_count = $13,
             remarks = $14,
             status = COALESCE(NULLIF($15, '')::text, status),
             approved_by = CASE
               WHEN $15 IS NOT NULL AND (UPPER($15) = 'APPROVED' OR UPPER($15) = 'REJECTED')
                 THEN COALESCE(NULLIF($16, '')::text, approved_by)
               ELSE approved_by
             END,
             updated_at = NOW()
       WHERE id = $1`,
      bookingId,
      vehicle_id ? Number(vehicle_id) : null,
      driver_id ? String(driver_id).trim() : null,
      booked_by ? String(booked_by).trim() : null,
      booked_by_email ? String(booked_by_email).trim().toLowerCase() : null,
      purpose ? String(purpose).trim() : null,
      destination ? String(destination).trim() : null,
      start_date || null,
      end_date || null,
      booking_period || 'FULL_DAY',
      start_time || null,
      end_time || null,
      passenger_count === undefined || passenger_count === null || passenger_count === '' ? null : Number(passenger_count),
      remarks ? String(remarks).trim() : null,
      normalizedStatus,
      approverId
    );

    const updatedBookingRows = await fetchVehicleBookingById(bookingId);
    const updatedBooking = mapVehicleBookingRow(updatedBookingRows[0]);

    if (normalizedStatus && normalizedStatus !== previousStatus) {
      void sendVehicleBookingStatusNotification(updatedBooking, normalizedStatus);
    }

    res.json({ success: true, booking: updatedBooking });
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
      `SELECT vb.id, vb.vehicle_id, v.vehicle_number, v.vehicle_name, vb.driver_id, du.name AS driver_name, du.staff_phone_no AS driver_phone_no, vb.booked_by, u.name AS booked_by_name, vb.booked_by_email,
              vb.purpose, vb.destination, vb.start_date, vb.end_date, vb.booking_period, vb.start_time, vb.end_time, vb.passenger_count, vb.remarks,
              vb.status, vb.approved_by, vb.created_at, vb.updated_at, u.department AS booked_by_department
         FROM public.vehicle_bookings vb
         LEFT JOIN public.vehicles v ON v.id = vb.vehicle_id
         LEFT JOIN "Driver" d ON d.id = vb.driver_id
         LEFT JOIN "User" du ON du.id = d."userId"
         LEFT JOIN public."User" u ON u.id = vb.booked_by
         WHERE vb.id = $1
         LIMIT 1`,
      bookingId
    );

    if (!existingRows.length) {
      return res.status(404).json({ message: 'Vehicle booking not found' });
    }

    const userRole = req.user?.role;
    const isManagementRole = userRole === ROLES.ADMIN || userRole === ROLES.RECEPTIONIST;
    if (!isManagementRole) {
      const isOwnBooking = existingRows[0].booked_by === req.user?.id;
      const sameDepartment = Boolean(req.user?.department) &&
        Boolean(existingRows[0].booked_by_department) &&
        req.user.department === existingRows[0].booked_by_department;

      if (!isOwnBooking && !sameDepartment) {
        return res.status(403).json({ message: 'You are not authorized to delete this booking.' });
      }
    }

    const bookingToDelete = mapVehicleBookingRow(existingRows[0]);
    const recipientEmails = [...new Set([
      ...VEHICLE_BOOKING_EMAILS,
      String(bookingToDelete.booked_by_email || '').trim().toLowerCase(),
    ].filter(isValidEmail))];

    await prisma.$queryRawUnsafe(
      `DELETE FROM public.vehicle_bookings WHERE id = $1`,
      bookingId
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const cancellationDetails = [
      `Vehicle: ${escapeHtml(bookingToDelete.vehicle_number || bookingToDelete.vehicle_name || `ID ${bookingToDelete.vehicle_id}`)}`,
      `Driver Name: ${escapeHtml(bookingToDelete.driver_name || 'N/A')}`,
      `Driver Phone: ${escapeHtml(bookingToDelete.driver_phone_no || 'N/A')}`,
      `Booked By: ${escapeHtml(bookingToDelete.booked_by_name || 'N/A')}`,
      `Purpose: ${escapeHtml(bookingToDelete.purpose || 'N/A')}`,
      `Destination: ${escapeHtml(bookingToDelete.destination || 'N/A')}`,
      `Start Date: ${formatEmailDate(bookingToDelete.start_date)}`,
      `End Date: ${formatEmailDate(bookingToDelete.end_date)}`,
      `Period: ${escapeHtml(humanizeBookingPeriod(bookingToDelete.booking_period))}`,
      `Start Time: ${formatEmailTime(bookingToDelete.start_time)}`,
      `End Time: ${formatEmailTime(bookingToDelete.end_time)}`,
      `Passengers: ${bookingToDelete.passenger_count || 'N/A'}`,
      `Remarks: ${escapeHtml(bookingToDelete.remarks || 'N/A')}`,
    ].join('<br>');

    const emailResult = await sendEmailNotificationToRecipients({
      recipients: recipientEmails,
      recipientName: bookingToDelete.booked_by_name,
      message: `We're writing to let you know that your vehicle booking has been cancelled.<br><br>${cancellationDetails}`,
      title: 'Vehicle Booking Cancelled',
      subject: `Vehicle Booking Cancelled${bookingToDelete.vehicle_number ? ` - ${bookingToDelete.vehicle_number}` : ''}`,
      actionUrl: `${frontendUrl}/vehicle-bookings`,
      label: 'Vehicle Booking',
      portalName: 'Vehicle Booking Portal',
    });

    if (!emailResult?.success) {
      console.error('Vehicle booking cancellation email failed for booking:', bookingId);
    }

    res.json({ success: true, message: 'Vehicle booking deleted successfully' });
  } catch (error) {
    console.error('Delete vehicle booking failed:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

const approveVehicleBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const bookingId = Number(id);

    const existingRows = await prisma.$queryRawUnsafe(
      `SELECT id, vehicle_id, start_date, end_date, start_time, end_time FROM public.vehicle_bookings WHERE id = $1 LIMIT 1`,
      bookingId
    );

    if (!existingRows.length) {
      return res.status(404).json({ message: 'Vehicle booking not found' });
    }

    const conflict = await findVehicleBookingConflict(
      existingRows[0].vehicle_id,
      existingRows[0].start_date,
      existingRows[0].end_date,
      existingRows[0].start_time,
      existingRows[0].end_time,
      bookingId
    );
    if (conflict) {
      return res.status(409).json({ message: conflictMessage(conflict, 'This vehicle') });
    }

    const approverId = String(req.user?.id || '').trim();

    const bookingRows = await prisma.$queryRawUnsafe(
      `UPDATE public.vehicle_bookings
         SET status = 'APPROVED',
             approved_by = NULLIF($2, '')::text,
             approved_at = NOW(),
             updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      bookingId,
      approverId
    );

    const updatedBookingRows = await fetchVehicleBookingById(bookingId);
    const updatedBooking = mapVehicleBookingRow(updatedBookingRows[0]);

    void sendVehicleBookingStatusNotification(updatedBooking, 'APPROVED');

    res.json({ success: true, booking: updatedBooking });
  } catch (error) {
    console.error('Approve vehicle booking failed:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

const rejectVehicleBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const bookingId = Number(id);
    const { remarks } = req.body;

    const existingRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM public.vehicle_bookings WHERE id = $1 LIMIT 1`,
      bookingId
    );

    if (!existingRows.length) {
      return res.status(404).json({ message: 'Vehicle booking not found' });
    }

    const approverId = String(req.user?.id || '').trim();

    await prisma.$queryRawUnsafe(
      `UPDATE public.vehicle_bookings
         SET status = 'REJECTED',
             approved_by = NULLIF($2, '')::text,
             remarks = COALESCE($3, remarks),
             updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      bookingId,
      approverId,
      remarks ? String(remarks).trim() : null
    );

    const updatedBookingRows = await fetchVehicleBookingById(bookingId);
    const updatedBooking = mapVehicleBookingRow(updatedBookingRows[0]);

    void sendVehicleBookingStatusNotification(updatedBooking, 'REJECTED');

    res.json({ success: true, booking: updatedBooking });
  } catch (error) {
    console.error('Reject vehicle booking failed:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

const sendVehicleBookingStatusNotification = async (booking, action) => {
  const upperAction = action.toUpperCase();
  if (upperAction === 'PENDING') {
    return;
  }

  const recipientEmails = [...new Set([
    ...VEHICLE_BOOKING_EMAILS,
    String(booking.booked_by_email || '').trim().toLowerCase(),
  ].filter(isValidEmail))];

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const actionLabel = upperAction === 'APPROVED' ? 'Approved'
    : upperAction === 'REJECTED' ? 'Rejected'
    : upperAction === 'CANCELLED' ? 'Cancelled'
    : 'Updated';
  const details = [
    `Vehicle: ${escapeHtml(booking.vehicle_number || booking.vehicle_name || `ID ${booking.vehicle_id}`)}`,
    `Driver Name: ${escapeHtml(booking.driver_name || 'N/A')}`,
    `Driver Phone: ${escapeHtml(booking.driver_phone_no || 'N/A')}`,
    `Booked By: ${escapeHtml(booking.booked_by_name || 'N/A')}`,
    `Purpose: ${escapeHtml(booking.purpose || 'N/A')}`,
    `Destination: ${escapeHtml(booking.destination || 'N/A')}`,
    `Start Date: ${formatEmailDate(booking.start_date)}`,
    `End Date: ${formatEmailDate(booking.end_date)}`,
    `Period: ${escapeHtml(humanizeBookingPeriod(booking.booking_period))}`,
    `Start Time: ${formatEmailTime(booking.start_time)}`,
    `End Time: ${formatEmailTime(booking.end_time)}`,
    `Passengers: ${booking.passenger_count || 'N/A'}`,
    `Remarks: ${escapeHtml(booking.remarks || 'N/A')}`,
  ].join('<br>');

  void sendEmailNotificationToRecipients({
    recipients: recipientEmails,
    recipientName: booking.booked_by_name,
    message: `Your vehicle booking has been <strong>${actionLabel}</strong>. Please find the details below.<br><br>${details}`,
    title: `Vehicle Booking ${actionLabel}`,
    subject: `Vehicle Booking ${actionLabel}${booking.vehicle_number ? ` - ${booking.vehicle_number}` : ''}`,
    actionUrl: `${frontendUrl}/vehicle-bookings`,
    label: 'Vehicle Booking',
    portalName: 'Vehicle Booking Portal',
  });
};

module.exports = {
  getVehicleBookings,
  createVehicleBooking,
  updateVehicleBooking,
  deleteVehicleBooking,
  approveVehicleBooking,
  rejectVehicleBooking,
};
