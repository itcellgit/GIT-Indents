const prisma = require('../prismaClient');
const generateBookIndentSerialNo = require('../utils/generateBookIndentSerialNo');
const { sendNotification } = require('../utils/notificationService');

const BOOK_TYPES = ['Reference', 'Textbook', 'General'];
const BOOKS_REQUIRED_FOR = ['UG', 'PG', 'Doctoral', 'Common to all/General Reading'];
const SEMESTERS = ['1st', '2nd', '3rd', '5th', '6th', '7th', '8th', 'Common to all'];

// status flow: Pending -> "In Progress" | "Rejected" -> (procured) -> "Books Arrived"
const STATUS = Object.freeze({
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  REJECTED: 'Rejected',
  ARRIVED: 'Books Arrived',
});

const SELECT_JOIN = `
  SELECT f.id, f.requested_by, f.requested_by_email, f.faculty_name, f.library_id_no,
         f.branch_id, b.branch_name, f.books_required_for, f.semester, f.book_author,
         f.book_title, f.book_edition, f.isbn, f.publisher, f.required_quantity, f.student_strength, f.book_type,
         f.remarks, f.status, f.serial_no, f.hod_remark, f.hod_reviewed_by, f.hod_reviewed_at,
         f.created_at, f.updated_at
  FROM public.faculty_book_indent_forms f
  LEFT JOIN public.branches b ON b.id = f.branch_id
`;

const mapRow = (row) => ({
  id: Number(row.id),
  requestedBy: row.requested_by,
  requestedByEmail: row.requested_by_email,
  facultyName: row.faculty_name,
  libraryIdNo: row.library_id_no,
  branchId: row.branch_id !== null && row.branch_id !== undefined ? Number(row.branch_id) : null,
  branchName: row.branch_name || '',
  booksRequiredFor: row.books_required_for,
  semester: row.semester,
  bookAuthor: row.book_author,
  bookTitle: row.book_title,
  bookEdition: row.book_edition,
  isbn: row.isbn,
  publisher: row.publisher,
  requiredQuantity: Number(row.required_quantity),
  studentStrength: Number(row.student_strength),
  bookType: row.book_type,
  remarks: row.remarks || '',
  status: row.status,
  serialNo: row.serial_no || '',
  hodRemark: row.hod_remark || '',
  hodReviewedBy: row.hod_reviewed_by || null,
  hodReviewedAt: row.hod_reviewed_at || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const createBookIndent = async (req, res) => {
  try {
    const {
      libraryIdNo,
      branchId,
      booksRequiredFor,
      semester,
      bookAuthor,
      bookTitle,
      bookEdition,
      isbn,
      publisher,
      requiredQuantity,
      studentStrength,
      bookType,
      remarks,
    } = req.body;

    if (!libraryIdNo || !String(libraryIdNo).trim()) {
      return res.status(400).json({ message: 'Library ID No. is required' });
    }
    if (!branchId) {
      return res.status(400).json({ message: 'Branch is required' });
    }
    if (!BOOKS_REQUIRED_FOR.includes(booksRequiredFor)) {
      return res.status(400).json({ message: 'Invalid value for "Books required for"' });
    }
    if (!SEMESTERS.includes(semester)) {
      return res.status(400).json({ message: 'Invalid semester' });
    }
    if (!bookAuthor || !String(bookAuthor).trim()) {
      return res.status(400).json({ message: 'Book author(s) is required' });
    }
    if (!bookTitle || !String(bookTitle).trim()) {
      return res.status(400).json({ message: 'Book title is required' });
    }
    if (!bookEdition || !String(bookEdition).trim()) {
      return res.status(400).json({ message: 'Book edition is required' });
    }
    if (!isbn || !String(isbn).trim()) {
      return res.status(400).json({ message: 'ISBN is required' });
    }
    if (!publisher || !String(publisher).trim()) {
      return res.status(400).json({ message: 'Publisher is required' });
    }
    const quantity = Number(requiredQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({ message: 'Required quantity must be a positive number' });
    }
    const strength = Number(studentStrength);
    if (!Number.isFinite(strength) || strength <= 0) {
      return res.status(400).json({ message: 'Student strength must be a positive number' });
    }
    if (!BOOK_TYPES.includes(bookType)) {
      return res.status(400).json({ message: 'Invalid type of book' });
    }

    const branchRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM public.branches WHERE id = $1 LIMIT 1`,
      Number(branchId)
    );
    if (!branchRows.length) {
      return res.status(400).json({ message: 'Invalid branch selected' });
    }

    const serialNo = await generateBookIndentSerialNo();

    const rows = await prisma.$queryRawUnsafe(
      `INSERT INTO public.faculty_book_indent_forms
        (requested_by, requested_by_email, faculty_name, library_id_no, branch_id,
         books_required_for, semester, book_author, book_title, book_edition, isbn, publisher,
         required_quantity, student_strength, book_type, remarks, status, serial_no, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'Pending', $17, NOW(), NOW())
       RETURNING id`,
      req.user.id,
      req.user.email,
      req.user.name,
      String(libraryIdNo).trim(),
      Number(branchId),
      booksRequiredFor,
      semester,
      String(bookAuthor).trim(),
      String(bookTitle).trim(),
      String(bookEdition).trim(),
      String(isbn).trim(),
      String(publisher).trim(),
      quantity,
      strength,
      bookType,
      remarks ? String(remarks).trim() : null,
      serialNo
    );

    const created = await prisma.$queryRawUnsafe(`${SELECT_JOIN} WHERE f.id = $1`, rows[0].id);

    res.status(201).json({ success: true, bookIndent: mapRow(created[0]) });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const getMyBookIndents = async (req, res) => {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `${SELECT_JOIN} WHERE f.requested_by = $1 ORDER BY f.created_at DESC`,
      req.user.id
    );
    res.json({ success: true, bookIndents: rows.map(mapRow) });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const getAllBookIndents = async (req, res) => {
  try {
    const rows = await prisma.$queryRawUnsafe(`${SELECT_JOIN} ORDER BY f.created_at DESC`);
    res.json({ success: true, bookIndents: rows.map(mapRow) });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const updateBookIndent = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      libraryIdNo,
      branchId,
      booksRequiredFor,
      semester,
      bookAuthor,
      bookTitle,
      bookEdition,
      isbn,
      publisher,
      requiredQuantity,
      studentStrength,
      bookType,
      remarks,
    } = req.body;

    const existing = await prisma.$queryRawUnsafe(
      `SELECT id, requested_by, status FROM public.faculty_book_indent_forms WHERE id = $1 LIMIT 1`,
      Number(id)
    );
    if (!existing.length) {
      return res.status(404).json({ message: 'Book indent not found' });
    }
    if (existing[0].requested_by !== req.user.id) {
      return res.status(403).json({ message: 'You can only edit your own book indents' });
    }
    if (existing[0].status !== STATUS.PENDING) {
      return res.status(400).json({ message: 'Only pending book indents can be edited' });
    }

    if (!libraryIdNo || !String(libraryIdNo).trim()) {
      return res.status(400).json({ message: 'Library ID No. is required' });
    }
    if (!branchId) {
      return res.status(400).json({ message: 'Branch is required' });
    }
    if (!BOOKS_REQUIRED_FOR.includes(booksRequiredFor)) {
      return res.status(400).json({ message: 'Invalid value for "Books required for"' });
    }
    if (!SEMESTERS.includes(semester)) {
      return res.status(400).json({ message: 'Invalid semester' });
    }
    if (!bookAuthor || !String(bookAuthor).trim()) {
      return res.status(400).json({ message: 'Book author(s) is required' });
    }
    if (!bookTitle || !String(bookTitle).trim()) {
      return res.status(400).json({ message: 'Book title is required' });
    }
    if (!bookEdition || !String(bookEdition).trim()) {
      return res.status(400).json({ message: 'Book edition is required' });
    }
    if (!isbn || !String(isbn).trim()) {
      return res.status(400).json({ message: 'ISBN is required' });
    }
    if (!publisher || !String(publisher).trim()) {
      return res.status(400).json({ message: 'Publisher is required' });
    }
    const quantity = Number(requiredQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({ message: 'Required quantity must be a positive number' });
    }
    const strength = Number(studentStrength);
    if (!Number.isFinite(strength) || strength <= 0) {
      return res.status(400).json({ message: 'Student strength must be a positive number' });
    }
    if (!BOOK_TYPES.includes(bookType)) {
      return res.status(400).json({ message: 'Invalid type of book' });
    }

    const branchRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM public.branches WHERE id = $1 LIMIT 1`,
      Number(branchId)
    );
    if (!branchRows.length) {
      return res.status(400).json({ message: 'Invalid branch selected' });
    }

    await prisma.$queryRawUnsafe(
      `UPDATE public.faculty_book_indent_forms
       SET library_id_no = $2, branch_id = $3, books_required_for = $4, semester = $5,
           book_author = $6, book_title = $7, book_edition = $8, isbn = $9, publisher = $10, required_quantity = $11,
           student_strength = $12, book_type = $13, remarks = $14, updated_at = NOW()
       WHERE id = $1`,
      Number(id),
      String(libraryIdNo).trim(),
      Number(branchId),
      booksRequiredFor,
      semester,
      String(bookAuthor).trim(),
      String(bookTitle).trim(),
      String(bookEdition).trim(),
      String(isbn).trim(),
      String(publisher).trim(),
      quantity,
      strength,
      bookType,
      remarks ? String(remarks).trim() : null
    );

    const updated = await prisma.$queryRawUnsafe(`${SELECT_JOIN} WHERE f.id = $1`, Number(id));

    res.json({ success: true, bookIndent: mapRow(updated[0]) });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const deleteBookIndent = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.$queryRawUnsafe(
      `SELECT id, requested_by, status FROM public.faculty_book_indent_forms WHERE id = $1 LIMIT 1`,
      Number(id)
    );
    if (!existing.length) {
      return res.status(404).json({ message: 'Book indent not found' });
    }
    if (existing[0].requested_by !== req.user.id) {
      return res.status(403).json({ message: 'You can only delete your own book indents' });
    }
    if (existing[0].status !== STATUS.PENDING) {
      return res.status(400).json({ message: 'Only pending book indents can be deleted' });
    }

    await prisma.$queryRawUnsafe(`DELETE FROM public.faculty_book_indent_forms WHERE id = $1`, Number(id));

    res.json({ success: true, message: 'Book indent deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// HOD reviews a pending book indent: approve (optionally adjusting the
// requested quantity) moves it straight to "In Progress" for procurement;
// reject requires a remark, which is emailed to the requester.
const reviewBookIndent = async (req, res) => {
  try {
    const { id } = req.params;
    const action = String(req.body.action || '').trim().toLowerCase();
    const remark = String(req.body.remark || '').trim();

    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ message: 'action must be "approve" or "reject"' });
    }
    if (action === 'reject' && !remark) {
      return res.status(400).json({ message: 'A remark is required when rejecting a book indent.' });
    }

    const existing = await prisma.$queryRawUnsafe(
      `SELECT id, requested_by, status, book_title, required_quantity FROM public.faculty_book_indent_forms WHERE id = $1 LIMIT 1`,
      Number(id)
    );
    if (!existing.length) {
      return res.status(404).json({ message: 'Book indent not found' });
    }
    if (existing[0].status !== STATUS.PENDING) {
      return res.status(409).json({ message: 'This book indent has already been reviewed.' });
    }

    let finalQuantity = Number(existing[0].required_quantity);
    if (action === 'approve' && req.body.requiredQuantity !== undefined) {
      const quantity = Number(req.body.requiredQuantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return res.status(400).json({ message: 'Required quantity must be a positive number' });
      }
      finalQuantity = quantity;
    }

    const nextStatus = action === 'approve' ? STATUS.IN_PROGRESS : STATUS.REJECTED;

    await prisma.$queryRawUnsafe(
      `UPDATE public.faculty_book_indent_forms
       SET status = $2, required_quantity = $3, hod_remark = $4, hod_reviewed_by = $5, hod_reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      Number(id),
      nextStatus,
      finalQuantity,
      remark || null,
      req.user.id
    );

    const updated = await prisma.$queryRawUnsafe(`${SELECT_JOIN} WHERE f.id = $1`, Number(id));
    const bookIndent = mapRow(updated[0]);

    if (action === 'reject') {
      try {
        await sendNotification(
          existing[0].requested_by,
          `Your book requisition for "${existing[0].book_title}" (Sl. No. ${bookIndent.serialNo || bookIndent.id}) has been rejected by the HOD: ${remark}`,
          req.user.id,
          null,
          bookIndent.serialNo
        );
      } catch (notifyError) {
        console.error('Book indent rejection notification failed:', notifyError.message);
      }
    }

    res.json({ success: true, bookIndent });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// Once procurement completes, the HOD marks an "In Progress" indent as
// "Books Arrived" so the requesting faculty is notified to collect the books.
const markBookIndentArrived = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.$queryRawUnsafe(
      `SELECT id, requested_by, status, book_title FROM public.faculty_book_indent_forms WHERE id = $1 LIMIT 1`,
      Number(id)
    );
    if (!existing.length) {
      return res.status(404).json({ message: 'Book indent not found' });
    }
    if (existing[0].status !== STATUS.IN_PROGRESS) {
      return res.status(409).json({ message: 'Only book indents that are in progress can be marked as arrived.' });
    }

    await prisma.$queryRawUnsafe(
      `UPDATE public.faculty_book_indent_forms
       SET status = $2, hod_reviewed_by = $3, hod_reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      Number(id),
      STATUS.ARRIVED,
      req.user.id
    );

    const updated = await prisma.$queryRawUnsafe(`${SELECT_JOIN} WHERE f.id = $1`, Number(id));
    const bookIndent = mapRow(updated[0]);

    try {
      await sendNotification(
        existing[0].requested_by,
        `The book(s) you requested, "${existing[0].book_title}" (Sl. No. ${bookIndent.serialNo || bookIndent.id}), have arrived and are available for collection from the library.`,
        req.user.id,
        null,
        bookIndent.serialNo
      );
    } catch (notifyError) {
      console.error('Book indent arrival notification failed:', notifyError.message);
    }

    res.json({ success: true, bookIndent });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  createBookIndent,
  getMyBookIndents,
  getAllBookIndents,
  updateBookIndent,
  deleteBookIndent,
  reviewBookIndent,
  markBookIndentArrived,
};
