const prisma = require('../prismaClient');
const { sendEmailNotificationToRecipients, escapeHtml, formatEmailDateTime } = require('../utils/notificationService');
const { ROLES } = require('../utils/roles');

const HALL_BOOKING_EMAILS = [
   'maintenance@git.edu',
   'productioncenter@git.edu',
   'epmc@git.edu',
   'itmaintenance@git.edu',
   'energycell@git.edu',
    'dmc@git.edu',
  //'rypatil@git.edu',
  // 'itcell@git.edu',
];

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

const mapHallBookingRow = (row) => ({
  id: Number(row.id),
  hall_id: Number(row.hall_id),
  hall_name: row.hall_name || '',
  booked_by: row.booked_by,
  booked_by_name: row.booked_by_name || '',
  booked_by_email: row.booked_by_email || '',
  purpose: row.purpose || '',
  start_datetime: row.start_datetime,
  end_datetime: row.end_datetime,
  remarks: row.remarks || '',
  status: row.status || 'PENDING',
  approved_by: row.approved_by || '',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toLocalDateTime = (value) => {
  if (!value) return null;
  const date = new Date(value);
  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// A hall booking "holds" its slot while PENDING or APPROVED; REJECTED/CANCELLED
// bookings never block a new request for the same slot.
const findHallBookingConflict = async (hallId, startDatetime, endDatetime, excludeId = null) => {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT hb.id, hb.purpose, hb.start_datetime, hb.end_datetime, u.name AS booked_by_name
     FROM public.hall_bookings hb
     LEFT JOIN public."User" u ON u.id = hb.booked_by
     WHERE hb.hall_id = $1
       AND hb.status IN ('PENDING', 'APPROVED')
       AND ($4::bigint IS NULL OR hb.id <> $4)
       AND hb.start_datetime < $3
       AND hb.end_datetime > $2
     ORDER BY hb.start_datetime ASC
     LIMIT 1`,
    hallId,
    startDatetime,
    endDatetime,
    excludeId
  );
  return rows[0] || null;
};

const conflictMessage = (conflict, resourceLabel) =>
  `${resourceLabel} is already booked for the requested time (conflicts with "${conflict.purpose || 'a booking'}" by ${conflict.booked_by_name || 'another user'}).`;

const getHallBookings = async (req, res) => {
  try {
    const bookings = await prisma.$queryRawUnsafe(
          `SELECT hb.id, hb.hall_id, h.name AS hall_name, hb.booked_by, u.name AS booked_by_name, hb.booked_by_email, hb.purpose, hb.start_datetime, hb.end_datetime,
            hb.remarks, hb.status, hb.approved_by, hb.created_at, hb.updated_at
       FROM public.hall_bookings hb
       LEFT JOIN public.halls h ON h.id = hb.hall_id
       LEFT JOIN public."User" u ON u.id = hb.booked_by
       ORDER BY hb.start_datetime DESC, hb.id DESC`
    );

    res.json({ success: true, bookings: bookings.map(mapHallBookingRow) });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const createHallBooking = async (req, res) => {
  try {
    const {
      hall_id,
      booked_by,
      booked_by_email,
      purpose,
      start_datetime,
      end_datetime,
      remarks,
      approved_by,
    } = req.body;

    if (!hall_id) {
      return res.status(400).json({ message: 'Hall is required' });
    }

    if (!booked_by || !String(booked_by).trim()) {
      return res.status(400).json({ message: 'Booked by is required' });
    }

    if (!isValidEmail(booked_by_email)) {
      return res.status(400).json({ message: 'A valid booked-by email is required' });
    }

    if (!start_datetime || !end_datetime) {
      return res.status(400).json({ message: 'Start and end time are required' });
    }

    const conflict = await findHallBookingConflict(Number(hall_id), new Date(start_datetime), new Date(end_datetime));
    if (conflict) {
      return res.status(409).json({ message: conflictMessage(conflict, 'This hall') });
    }

    const bookingRows = await prisma.$queryRawUnsafe(
      `INSERT INTO public.hall_bookings (hall_id, booked_by, booked_by_email, purpose, start_datetime, end_datetime, remarks, approved_by, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', NOW(), NOW())
       RETURNING id, hall_id, booked_by, booked_by_email, purpose, start_datetime, end_datetime, remarks, status, approved_by, created_at, updated_at`,
      Number(hall_id),
      String(booked_by).trim(),
      String(booked_by_email).trim().toLowerCase(),
      purpose ? String(purpose).trim() : null,
      new Date(start_datetime),
      new Date(end_datetime),
      remarks ? String(remarks).trim() : null,
      approved_by ? String(approved_by).trim() : null
    );

    const createdBookingRows = await prisma.$queryRawUnsafe(
      `SELECT hb.id, hb.hall_id, h.name AS hall_name, hb.booked_by, u.name AS booked_by_name, hb.booked_by_email, hb.purpose, hb.start_datetime, hb.end_datetime,
        hb.remarks, hb.status, hb.approved_by, hb.created_at, hb.updated_at
       FROM public.hall_bookings hb
       LEFT JOIN public.halls h ON h.id = hb.hall_id
       LEFT JOIN public."User" u ON u.id = hb.booked_by
       WHERE hb.id = $1
       LIMIT 1`,
      Number(bookingRows[0].id)
    );

    const createdBooking = mapHallBookingRow(createdBookingRows[0] || bookingRows[0]);

    res.status(201).json({ success: true, booking: createdBooking });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

  const updateHallBooking = async (req, res) => {
    try {
      const { id } = req.params;
      const bookingId = Number(id);
      const {
        hall_id,
        booked_by,
        booked_by_email,
        purpose,
        start_datetime,
        end_datetime,
        remarks,
        status,
        approved_by,
      } = req.body;

      const beforeRows = await prisma.$queryRawUnsafe(
        `SELECT hb.status, hb.booked_by, hb.hall_id, hb.start_datetime, hb.end_datetime, u.department AS booked_by_department
         FROM public.hall_bookings hb
         LEFT JOIN public."User" u ON u.id = hb.booked_by
         WHERE hb.id = $1 LIMIT 1`,
        bookingId
      );

      if (!beforeRows.length) {
        return res.status(404).json({ message: 'Hall booking not found' });
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
        const effectiveHallId = hall_id ? Number(hall_id) : Number(beforeRows[0].hall_id);
        const effectiveStart = start_datetime ? new Date(start_datetime) : beforeRows[0].start_datetime;
        const effectiveEnd = end_datetime ? new Date(end_datetime) : beforeRows[0].end_datetime;

        const conflict = await findHallBookingConflict(effectiveHallId, effectiveStart, effectiveEnd, bookingId);
        if (conflict) {
          return res.status(409).json({ message: conflictMessage(conflict, 'This hall') });
        }
      }

      if (booked_by_email && !isValidEmail(booked_by_email)) {
        return res.status(400).json({ message: 'Invalid booked-by email format' });
      }

      await prisma.$queryRawUnsafe(
        `UPDATE public.hall_bookings
         SET hall_id = COALESCE($2, hall_id),
             booked_by = COALESCE($3, booked_by),
             booked_by_email = COALESCE($4, booked_by_email),
             purpose = $5,
             start_datetime = COALESCE($6, start_datetime),
             end_datetime = COALESCE($7, end_datetime),
             remarks = $8,
             status = COALESCE(NULLIF($9, '')::text, status),
             approved_by = CASE
               WHEN $9 IS NOT NULL AND (UPPER($9) = 'APPROVED' OR UPPER($9) = 'REJECTED')
                 THEN COALESCE(NULLIF($10, '')::text, approved_by)
               ELSE approved_by
             END,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id`,
        bookingId,
        hall_id ? Number(hall_id) : null,
        booked_by ? String(booked_by).trim() : null,
        booked_by_email ? String(booked_by_email).trim().toLowerCase() : null,
        purpose ? String(purpose).trim() : null,
        start_datetime ? new Date(start_datetime) : null,
        end_datetime ? new Date(end_datetime) : null,
        remarks ? String(remarks).trim() : null,
        normalizedStatus,
        approverId
      );

      const updatedBookingRows = await fetchHallBookingById(bookingId);
      const updatedBooking = mapHallBookingRow(updatedBookingRows[0]);

      if (normalizedStatus && normalizedStatus !== previousStatus) {
        void sendBookingStatusNotification(updatedBooking, normalizedStatus);
      }

      res.json({ success: true, booking: updatedBooking });
    } catch (error) {
      res.status(500).json({ message: 'Server Error' });
    }
  };

const deleteHallBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const bookingId = Number(id);

    const existingRows = await prisma.$queryRawUnsafe(
      `SELECT hb.id, hb.hall_id, h.name AS hall_name, hb.booked_by, u.name AS booked_by_name, hb.booked_by_email, hb.purpose,
              hb.start_datetime, hb.end_datetime, hb.remarks, hb.status, hb.approved_by, hb.created_at, hb.updated_at, u.department AS booked_by_department
       FROM public.hall_bookings hb
       LEFT JOIN public.halls h ON h.id = hb.hall_id
       LEFT JOIN public."User" u ON u.id = hb.booked_by
       WHERE hb.id = $1
       LIMIT 1`,
      bookingId
    );

    if (!existingRows.length) {
      return res.status(404).json({ message: 'Hall booking not found' });
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

    const bookingToDelete = mapHallBookingRow(existingRows[0]);
    const recipientEmails = [...new Set([
      ...HALL_BOOKING_EMAILS,
      String(bookingToDelete.booked_by_email || '').trim().toLowerCase(),
    ].filter(isValidEmail))];

    await prisma.$queryRawUnsafe(
      `DELETE FROM public.hall_bookings WHERE id = $1`,
      bookingId
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const cancellationDetails = [
      `Hall: ${escapeHtml(bookingToDelete.hall_name || `ID ${bookingToDelete.hall_id}`)}`,
      `Booked By: ${escapeHtml(bookingToDelete.booked_by_name || 'N/A')}`,
      `Booked By Email: ${escapeHtml(bookingToDelete.booked_by_email || 'N/A')}`,
      `Purpose: ${escapeHtml(bookingToDelete.purpose || 'N/A')}`,
      `Start: ${formatEmailDateTime(bookingToDelete.start_datetime)}`,
      `End: ${formatEmailDateTime(bookingToDelete.end_datetime)}`,
      `Remarks: ${escapeHtml(bookingToDelete.remarks || 'N/A')}`,
    ].join('<br>');

    const emailResult = await sendEmailNotificationToRecipients({
      recipients: recipientEmails,
      recipientName: bookingToDelete.booked_by_name,
      message: `We're writing to let you know that your hall booking has been cancelled.<br><br>${cancellationDetails}`,
      title: 'Hall Booking Cancelled',
      subject: `Hall Booking Cancelled${bookingToDelete.hall_name ? ` - ${bookingToDelete.hall_name}` : ''}`,
      actionUrl: `${frontendUrl}/hall-bookings`,
      label: 'Hall Booking',
      portalName: 'Hall Booking Portal',
    });

    if (!emailResult?.success) {
      console.error('Hall booking cancellation email failed for booking:', bookingId);
    }

    res.json({ success: true, message: 'Hall booking deleted successfully' });
  } catch (error) {
    console.error('Delete hall booking failed:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

const fetchHallBookingById = async (bookingId) => {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT hb.id, hb.hall_id, h.name AS hall_name, hb.booked_by, u.name AS booked_by_name, hb.booked_by_email, hb.purpose, hb.start_datetime, hb.end_datetime,
         hb.remarks, hb.status, hb.approved_by, hb.created_at, hb.updated_at
      FROM public.hall_bookings hb
      LEFT JOIN public.halls h ON h.id = hb.hall_id
      LEFT JOIN public."User" u ON u.id = hb.booked_by
      WHERE hb.id = $1
      LIMIT 1`,
    bookingId
  );
  return rows;
};

const sendBookingStatusNotification = async (booking, action) => {
  const upperAction = action.toUpperCase();
  if (upperAction === 'PENDING') {
    return;
  }

  const recipientEmails = [...new Set([
    ...HALL_BOOKING_EMAILS,
    String(booking.booked_by_email || '').trim().toLowerCase(),
  ].filter(isValidEmail))];

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const actionLabel = upperAction === 'APPROVED' ? 'Approved'
    : upperAction === 'REJECTED' ? 'Rejected'
    : upperAction === 'CANCELLED' ? 'Cancelled'
    : 'Updated';
  const details = [
    `Hall: ${escapeHtml(booking.hall_name || `ID ${booking.hall_id}`)}`,
    `Booked By: ${escapeHtml(booking.booked_by_name || 'N/A')}`,
    `Booked By Email: ${escapeHtml(booking.booked_by_email || 'N/A')}`,
    `Purpose: ${escapeHtml(booking.purpose || 'N/A')}`,
    `Start: ${formatEmailDateTime(booking.start_datetime)}`,
    `End: ${formatEmailDateTime(booking.end_datetime)}`,
    `Remarks: ${escapeHtml(booking.remarks || 'N/A')}`,
  ].join('<br>');

  void sendEmailNotificationToRecipients({
    recipients: recipientEmails,
    recipientName: booking.booked_by_name,
    message: `Your hall booking has been <strong>${actionLabel}</strong>. Please find the details below.<br><br>${details}`,
    title: `Hall Booking ${actionLabel}`,
    subject: `Hall Booking ${actionLabel}${booking.hall_name ? ` - ${booking.hall_name}` : ''}`,
    actionUrl: `${frontendUrl}/hall-bookings`,
    label: 'Hall Booking',
    portalName: 'Hall Booking Portal',
  });
};

const approveHallBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const bookingId = Number(id);

    const existingRows = await prisma.$queryRawUnsafe(
      `SELECT id, hall_id, start_datetime, end_datetime FROM public.hall_bookings WHERE id = $1 LIMIT 1`,
      bookingId
    );

    if (!existingRows.length) {
      return res.status(404).json({ message: 'Hall booking not found' });
    }

    const conflict = await findHallBookingConflict(
      Number(existingRows[0].hall_id),
      existingRows[0].start_datetime,
      existingRows[0].end_datetime,
      bookingId
    );
    if (conflict) {
      return res.status(409).json({ message: conflictMessage(conflict, 'This hall') });
    }

    const approverId = String(req.user?.id || '').trim();

    const bookingRows = await prisma.$queryRawUnsafe(
      `UPDATE public.hall_bookings
       SET status = 'APPROVED',
           approved_by = NULLIF($2, '')::text,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      bookingId,
      approverId
    );

    const updatedBookingRows = await fetchHallBookingById(bookingId);
    const updatedBooking = mapHallBookingRow(updatedBookingRows[0]);

    void sendBookingStatusNotification(updatedBooking, 'APPROVED');

    res.json({ success: true, booking: updatedBooking });
  } catch (error) {
    console.error('Approve hall booking failed:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

const rejectHallBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const bookingId = Number(id);
    const { remarks } = req.body;

    const existingRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM public.hall_bookings WHERE id = $1 LIMIT 1`,
      bookingId
    );

    if (!existingRows.length) {
      return res.status(404).json({ message: 'Hall booking not found' });
    }

    const approverId = String(req.user?.id || '').trim();

    await prisma.$queryRawUnsafe(
      `UPDATE public.hall_bookings
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

    const updatedBookingRows = await fetchHallBookingById(bookingId);
    const updatedBooking = mapHallBookingRow(updatedBookingRows[0]);

    void sendBookingStatusNotification(updatedBooking, 'REJECTED');

    res.json({ success: true, booking: updatedBooking });
  } catch (error) {
    console.error('Reject hall booking failed:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getHallBookings,
  createHallBooking,
  updateHallBooking,
  deleteHallBooking,
  approveHallBooking,
  rejectHallBooking,
};