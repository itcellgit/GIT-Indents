const prisma = require('../prismaClient');
const { sendEmailNotificationToRecipients } = require('../utils/notificationService');
const { ROLES } = require('../utils/roles');

const BUS_BOOKING_EMAILS = [];

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

const mapBusBookingRow = (row) => ({
  id: Number(row.id),
  bus_id: row.bus_id === null || row.bus_id === undefined ? null : Number(row.bus_id),
  bus_number: row.bus_number || '',
  bus_name: row.bus_name || '',
  bus_type: row.bus_type || '',
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

const fetchBusBookingById = async (bookingId) => {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT bb.id, bb.bus_id, b.bus_number, b.bus_name, b.bus_type,
            bb.booked_by, u.name AS booked_by_name, u.email AS booked_by_email, bb.purpose, bb.destination, bb.start_date, bb.end_date, bb.booking_period, bb.start_time, bb.end_time,
            bb.passenger_count, bb.status, bb.approved_by, bb.approved_at, bb.remarks,
            bb.created_at, bb.updated_at, u.department AS booked_by_department
     FROM public.bus_bookings bb
     LEFT JOIN public.buses b ON b.id = bb.bus_id
     LEFT JOIN public."User" u ON u.id = bb.booked_by
     WHERE bb.id = $1
     LIMIT 1`,
    bookingId
  );
  return rows;
};

const getBusBookings = async (req, res) => {
  try {
    const bookings = await prisma.$queryRawUnsafe(
      `SELECT bb.id, bb.bus_id, b.bus_number, b.bus_name, b.bus_type,
              bb.booked_by, u.name AS booked_by_name, u.email AS booked_by_email, bb.purpose, bb.destination, bb.start_date, bb.end_date, bb.booking_period, bb.start_time, bb.end_time,
              bb.passenger_count, bb.status, bb.approved_by, bb.approved_at, bb.remarks,
              bb.created_at, bb.updated_at
         FROM public.bus_bookings bb
         LEFT JOIN public.buses b ON b.id = bb.bus_id
         LEFT JOIN public."User" u ON u.id = bb.booked_by
         ORDER BY bb.start_date DESC, bb.id DESC`
    );

    res.json({ success: true, bookings: bookings.map(mapBusBookingRow) });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const createBusBooking = async (req, res) => {
  try {
    const {
      bus_id,
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

    if (!start_date) {
      return res.status(400).json({ message: 'Start date is required' });
    }

    const bookingRows = await prisma.$queryRawUnsafe(
      `INSERT INTO public.bus_bookings
        (bus_id, booked_by, booked_by_email, purpose, destination, start_date, end_date, booking_period, start_time, end_time, passenger_count, remarks, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'PENDING', NOW(), NOW())
       RETURNING id`,
      bus_id ? Number(bus_id) : null,
      String(booked_by).trim(),
      req.body.booked_by_email ? String(req.body.booked_by_email).trim() : null,
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

    const createdBookingRows = await fetchBusBookingById(Number(bookingRows[0].id));
    const createdBooking = mapBusBookingRow(createdBookingRows[0]);

    res.status(201).json({ success: true, booking: createdBooking });
  } catch (error) {
    console.error('Create bus booking failed:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const updateBusBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const bookingId = Number(id);
    const {
      bus_id,
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
    } = req.body;

    const beforeRows = await prisma.$queryRawUnsafe(
      `SELECT bb.status, bb.booked_by, u.department AS booked_by_department
       FROM public.bus_bookings bb
       LEFT JOIN public."User" u ON u.id = bb.booked_by
       WHERE bb.id = $1 LIMIT 1`,
      bookingId
    );

    if (!beforeRows.length) {
      return res.status(404).json({ message: 'Bus booking not found' });
    }

    const previousStatus = (beforeRows[0].status || 'PENDING').toUpperCase();
    const normalizedStatus = status ? String(status).trim().toUpperCase() : null;
    const approverId = String(req.user?.id || '').trim();

    const userRole = req.user?.role;
    const isManagementRole = userRole === ROLES.ADMIN || userRole === ROLES.TRANSPORT;

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

    await prisma.$queryRawUnsafe(
      `UPDATE public.bus_bookings
         SET bus_id = COALESCE($2, bus_id),
             booked_by = COALESCE($3, booked_by),
             booked_by_email = COALESCE($4, booked_by_email),
             purpose = $5,
             destination = $6,
             start_date = COALESCE($7, start_date),
             end_date = COALESCE($8, end_date),
             booking_period = COALESCE($9, booking_period),
             start_time = $10,
             end_time = $11,
             passenger_count = $12,
             remarks = $13,
             status = COALESCE(NULLIF($14, '')::text, status),
             approved_by = CASE
               WHEN $14 IS NOT NULL AND (UPPER($14) = 'APPROVED' OR UPPER($14) = 'REJECTED')
                 THEN COALESCE(NULLIF($15, '')::text, approved_by)
               ELSE approved_by
             END,
             updated_at = NOW()
       WHERE id = $1`,
      bookingId,
      bus_id ? Number(bus_id) : null,
      booked_by ? String(booked_by).trim() : null,
      booked_by_email ? String(booked_by_email).trim() : null,
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

    const updatedBookingRows = await fetchBusBookingById(bookingId);
    const updatedBooking = mapBusBookingRow(updatedBookingRows[0]);

    if (normalizedStatus && normalizedStatus !== previousStatus) {
      void sendBusBookingStatusNotification(updatedBooking, normalizedStatus);
    }

    res.json({ success: true, booking: updatedBooking });
  } catch (error) {
    console.error('Update bus booking failed:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const deleteBusBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const bookingId = Number(id);

    const existingRows = await fetchBusBookingById(bookingId);

    if (!existingRows.length) {
      return res.status(404).json({ message: 'Bus booking not found' });
    }

    const userRole = req.user?.role;
    const isManagementRole = userRole === ROLES.ADMIN || userRole === ROLES.TRANSPORT;
    if (!isManagementRole) {
      const isOwnBooking = existingRows[0].booked_by === req.user?.id;
      const sameDepartment = Boolean(req.user?.department) &&
        Boolean(existingRows[0].booked_by_department) &&
        req.user.department === existingRows[0].booked_by_department;

      if (!isOwnBooking && !sameDepartment) {
        return res.status(403).json({ message: 'You are not authorized to delete this booking.' });
      }
    }

    const bookingToDelete = mapBusBookingRow(existingRows[0]);
    const recipientEmails = [...new Set([
      ...BUS_BOOKING_EMAILS,
      String(bookingToDelete.booked_by_email || '').trim().toLowerCase(),
    ].filter(isValidEmail))];

    await prisma.$queryRawUnsafe(
      `DELETE FROM public.bus_bookings WHERE id = $1`,
      bookingId
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const cancellationDetails = [
      `Bus: ${bookingToDelete.bus_number || bookingToDelete.bus_name || `ID ${bookingToDelete.bus_id}`}`,
      `Booked by: ${bookingToDelete.booked_by_name || bookingToDelete.booked_by || 'N/A'}`,
      `Purpose: ${bookingToDelete.purpose || 'N/A'}`,
      `Destination: ${bookingToDelete.destination || 'N/A'}`,
      `Start Date: ${bookingToDelete.start_date || 'N/A'}`,
      `End Date: ${bookingToDelete.end_date || 'N/A'}`,
      `Period: ${bookingToDelete.booking_period || 'N/A'}`,
      `Start Time: ${bookingToDelete.start_time || 'N/A'}`,
      `End Time: ${bookingToDelete.end_time || 'N/A'}`,
      `Passengers: ${bookingToDelete.passenger_count || 'N/A'}`,
      `Remarks: ${bookingToDelete.remarks || 'N/A'}`,
    ].join('<br>');

    const emailResult = await sendEmailNotificationToRecipients({
      recipients: recipientEmails,
      message: `A previously scheduled bus booking has been cancelled.<br><br>${cancellationDetails}`,
      title: 'Bus Booking Cancelled',
      subject: `Bus Booking Cancelled${bookingToDelete.bus_number ? ` - ${bookingToDelete.bus_number}` : ''}`,
      actionUrl: `${frontendUrl}/bus-bookings`,
      label: 'Bus Booking',
    });

    if (!emailResult?.success) {
      console.error('Bus booking cancellation email failed for booking:', bookingId);
    }

    res.json({ success: true, message: 'Bus booking deleted successfully' });
  } catch (error) {
    console.error('Delete bus booking failed:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

const approveBusBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const bookingId = Number(id);

    const existingRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM public.bus_bookings WHERE id = $1 LIMIT 1`,
      bookingId
    );

    if (!existingRows.length) {
      return res.status(404).json({ message: 'Bus booking not found' });
    }

    const approverId = String(req.user?.id || '').trim();

    await prisma.$queryRawUnsafe(
      `UPDATE public.bus_bookings
         SET status = 'APPROVED',
             approved_by = NULLIF($2, '')::text,
             approved_at = NOW(),
             updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      bookingId,
      approverId
    );

    const updatedBookingRows = await fetchBusBookingById(bookingId);
    const updatedBooking = mapBusBookingRow(updatedBookingRows[0]);

    void sendBusBookingStatusNotification(updatedBooking, 'APPROVED');

    res.json({ success: true, booking: updatedBooking });
  } catch (error) {
    console.error('Approve bus booking failed:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

const rejectBusBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const bookingId = Number(id);
    const { remarks } = req.body;

    const existingRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM public.bus_bookings WHERE id = $1 LIMIT 1`,
      bookingId
    );

    if (!existingRows.length) {
      return res.status(404).json({ message: 'Bus booking not found' });
    }

    const approverId = String(req.user?.id || '').trim();

    await prisma.$queryRawUnsafe(
      `UPDATE public.bus_bookings
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

    const updatedBookingRows = await fetchBusBookingById(bookingId);
    const updatedBooking = mapBusBookingRow(updatedBookingRows[0]);

    void sendBusBookingStatusNotification(updatedBooking, 'REJECTED');

    res.json({ success: true, booking: updatedBooking });
  } catch (error) {
    console.error('Reject bus booking failed:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

const sendBusBookingStatusNotification = async (booking, action) => {
  const upperAction = action.toUpperCase();
  if (upperAction === 'PENDING') {
    return;
  }

  const recipientEmails = [...new Set([
    ...BUS_BOOKING_EMAILS,
    String(booking.booked_by_email || '').trim().toLowerCase(),
  ].filter(isValidEmail))];

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const actionLabel = upperAction === 'APPROVED' ? 'Approved'
    : upperAction === 'REJECTED' ? 'Rejected'
    : upperAction === 'CANCELLED' ? 'Cancelled'
    : 'Updated';
  const details = [
    `Bus: ${booking.bus_number || booking.bus_name || `ID ${booking.bus_id}`}`,
    `Booked by: ${booking.booked_by_name || booking.booked_by || 'N/A'}`,
    `Purpose: ${booking.purpose || 'N/A'}`,
    `Destination: ${booking.destination || 'N/A'}`,
    `Start Date: ${booking.start_date || 'N/A'}`,
    `End Date: ${booking.end_date || 'N/A'}`,
    `Period: ${booking.booking_period || 'N/A'}`,
    `Start Time: ${booking.start_time || 'N/A'}`,
    `End Time: ${booking.end_time || 'N/A'}`,
    `Passengers: ${booking.passenger_count || 'N/A'}`,
    `Remarks: ${booking.remarks || 'N/A'}`,
  ].join('<br>');

  void sendEmailNotificationToRecipients({
    recipients: recipientEmails,
    message: `Your bus booking has been <strong>${actionLabel}</strong>.<br><br>${details}`,
    title: `Bus Booking ${actionLabel}`,
    subject: `Bus Booking ${actionLabel}${booking.bus_number ? ` - ${booking.bus_number}` : ''}`,
    actionUrl: `${frontendUrl}/bus-bookings`,
    label: 'Bus Booking',
  });
};

module.exports = {
  getBusBookings,
  createBusBooking,
  updateBusBooking,
  deleteBusBooking,
  approveBusBooking,
  rejectBusBooking,
};
