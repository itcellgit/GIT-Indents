const prisma = require('../prismaClient');
const { sendEmailNotificationToRecipients, escapeHtml, formatEmailDate, formatEmailTime } = require('../utils/notificationService');
const { ROLES } = require('../utils/roles');

const BUS_BOOKING_EMAILS = [];

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

const BOOKING_PERIOD_LABELS = {
  MORNING: 'Morning',
  SECOND_HALF: 'Second Half',
  FULL_DAY: 'Full Day',
  CUSTOM: 'Custom',
};
const humanizeBookingPeriod = (period) => BOOKING_PERIOD_LABELS[period] || period || 'N/A';

const mapBusBookingRow = (row) => ({
  id: Number(row.id),
  bus_id: row.bus_id === null || row.bus_id === undefined ? null : Number(row.bus_id),
  bus_number: row.bus_number || '',
  bus_name: row.bus_name || '',
  bus_type: row.bus_type || '',
  driver_id: row.driver_id || null,
  driver_name: row.driver_name || '',
  driver_phone_no: row.driver_phone_no || '',
  attachment_path: row.attachment_path || null,
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

// A bus booking "holds" its slot while PENDING or APPROVED; REJECTED/CANCELLED
// bookings never block a new request for the same slot. No bus assigned yet
// (busId null) means nothing to conflict against.
const findBusBookingConflict = async (busId, startDate, endDate, startTime, endTime, excludeId = null) => {
  if (!busId) return null;
  const rows = await prisma.$queryRawUnsafe(
    `SELECT bb.id, bb.purpose, bb.start_date, bb.end_date, u.name AS booked_by_name
     FROM public.bus_bookings bb
     LEFT JOIN public."User" u ON u.id = bb.booked_by
     WHERE bb.bus_id = $1
       AND bb.status IN ('PENDING', 'APPROVED')
       AND ($6::bigint IS NULL OR bb.id <> $6)
       AND (bb.start_date + bb.start_time) < ($3::date + $5::time)
       AND (bb.end_date + bb.end_time) > ($2::date + $4::time)
     ORDER BY bb.start_date ASC, bb.start_time ASC
     LIMIT 1`,
    busId,
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

const fetchBusBookingById = async (bookingId) => {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT bb.id, bb.bus_id, b.bus_number, b.bus_name, b.bus_type,
            bb.driver_id, du.name AS driver_name, du.staff_phone_no AS driver_phone_no,
            bb.booked_by, u.name AS booked_by_name, u.email AS booked_by_email, bb.purpose, bb.destination, bb.start_date, bb.end_date, bb.booking_period, bb.start_time, bb.end_time,
            bb.passenger_count, bb.status, bb.approved_by, bb.approved_at, bb.remarks, bb.attachment_path,
            bb.created_at, bb.updated_at, u.department AS booked_by_department
     FROM public.bus_bookings bb
     LEFT JOIN public.buses b ON b.id = bb.bus_id
     LEFT JOIN "Driver" d ON d.id = bb.driver_id
     LEFT JOIN "User" du ON du.id = d."userId"
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
              bb.driver_id, du.name AS driver_name, du.staff_phone_no AS driver_phone_no,
              bb.booked_by, u.name AS booked_by_name, u.email AS booked_by_email, bb.purpose, bb.destination, bb.start_date, bb.end_date, bb.booking_period, bb.start_time, bb.end_time,
              bb.passenger_count, bb.status, bb.approved_by, bb.approved_at, bb.remarks, bb.attachment_path,
              bb.created_at, bb.updated_at
         FROM public.bus_bookings bb
         LEFT JOIN public.buses b ON b.id = bb.bus_id
         LEFT JOIN "Driver" d ON d.id = bb.driver_id
         LEFT JOIN "User" du ON du.id = d."userId"
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

    const conflict = await findBusBookingConflict(
      bus_id ? Number(bus_id) : null,
      start_date,
      end_date || start_date,
      start_time || '00:00',
      end_time || '23:59:59',
    );
    if (conflict) {
      return res.status(409).json({ message: conflictMessage(conflict, 'This bus') });
    }

    let attachmentPath = null;
    if (req.file) {
      const uploadDir = process.env.UPLOAD_DIR || 'uploads';
      attachmentPath = `/${uploadDir}/${req.file.filename}`;
    }

    const bookingRows = await prisma.$queryRawUnsafe(
      `INSERT INTO public.bus_bookings
        (bus_id, driver_id, booked_by, booked_by_email, purpose, destination, start_date, end_date, booking_period, start_time, end_time, passenger_count, remarks, attachment_path, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'PENDING', NOW(), NOW())
       RETURNING id`,
      bus_id ? Number(bus_id) : null,
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
      remarks ? String(remarks).trim() : null,
      attachmentPath
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
    } = req.body;

    const beforeRows = await prisma.$queryRawUnsafe(
      `SELECT bb.status, bb.booked_by, bb.bus_id, bb.start_date, bb.end_date, bb.start_time, bb.end_time, u.department AS booked_by_department
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

    const effectiveStatus = normalizedStatus || previousStatus;
    if (['PENDING', 'APPROVED'].includes(effectiveStatus)) {
      const effectiveBusId = bus_id ? Number(bus_id) : beforeRows[0].bus_id;
      const effectiveStartDate = start_date || beforeRows[0].start_date;
      const effectiveEndDate = end_date || beforeRows[0].end_date;
      const effectiveStartTime = start_time || beforeRows[0].start_time;
      const effectiveEndTime = end_time || beforeRows[0].end_time;

      const conflict = await findBusBookingConflict(
        effectiveBusId,
        effectiveStartDate,
        effectiveEndDate,
        effectiveStartTime,
        effectiveEndTime,
        bookingId
      );
      if (conflict) {
        return res.status(409).json({ message: conflictMessage(conflict, 'This bus') });
      }
    }

    if (booked_by_email && !isValidEmail(booked_by_email)) {
      return res.status(400).json({ message: 'Invalid booked-by email format' });
    }

    let attachmentPath = null;
    if (req.file) {
      const uploadDir = process.env.UPLOAD_DIR || 'uploads';
      attachmentPath = `/${uploadDir}/${req.file.filename}`;
    }

    await prisma.$queryRawUnsafe(
      `UPDATE public.bus_bookings
         SET bus_id = COALESCE($2, bus_id),
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
             attachment_path = COALESCE($15, attachment_path),
             status = COALESCE(NULLIF($16, '')::text, status),
             approved_by = CASE
               WHEN $16 IS NOT NULL AND (UPPER($16) = 'APPROVED' OR UPPER($16) = 'REJECTED')
                 THEN COALESCE(NULLIF($17, '')::text, approved_by)
               ELSE approved_by
             END,
             updated_at = NOW()
       WHERE id = $1`,
      bookingId,
      bus_id ? Number(bus_id) : null,
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
      attachmentPath,
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
      `Bus: ${escapeHtml(bookingToDelete.bus_number || bookingToDelete.bus_name || `ID ${bookingToDelete.bus_id}`)}`,
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
      message: `We're writing to let you know that your bus booking has been cancelled.<br><br>${cancellationDetails}`,
      title: 'Bus Booking Cancelled',
      subject: `Bus Booking Cancelled${bookingToDelete.bus_number ? ` - ${bookingToDelete.bus_number}` : ''}`,
      actionUrl: `${frontendUrl}/bus-bookings`,
      label: 'Bus Booking',
      portalName: 'Bus Booking Portal',
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
      `SELECT id, bus_id, start_date, end_date, start_time, end_time FROM public.bus_bookings WHERE id = $1 LIMIT 1`,
      bookingId
    );

    if (!existingRows.length) {
      return res.status(404).json({ message: 'Bus booking not found' });
    }

    if (!existingRows[0].bus_id) {
      return res.status(400).json({ message: 'Assign a bus to this booking before approving it' });
    }

    const conflict = await findBusBookingConflict(
      existingRows[0].bus_id,
      existingRows[0].start_date,
      existingRows[0].end_date,
      existingRows[0].start_time,
      existingRows[0].end_time,
      bookingId
    );
    if (conflict) {
      return res.status(409).json({ message: conflictMessage(conflict, 'This bus') });
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
    `Bus: ${escapeHtml(booking.bus_number || booking.bus_name || `ID ${booking.bus_id}`)}`,
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
    message: `Your bus booking has been <strong>${actionLabel}</strong>. Please find the details below.<br><br>${details}`,
    title: `Bus Booking ${actionLabel}`,
    subject: `Bus Booking ${actionLabel}${booking.bus_number ? ` - ${booking.bus_number}` : ''}`,
    actionUrl: `${frontendUrl}/bus-bookings`,
    label: 'Bus Booking',
    portalName: 'Bus Booking Portal',
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
