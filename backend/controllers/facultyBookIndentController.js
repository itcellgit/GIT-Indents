const prisma = require('../prismaClient');

const BOOK_TYPES = ['Reference', 'Textbook', 'General'];
const BOOKS_REQUIRED_FOR = ['UG', 'PG', 'Doctoral', 'Common to all/General Reading'];
const SEMESTERS = ['1st', '2nd', '3rd', '5th', '6th', '7th', '8th', 'Common to all'];

const SELECT_JOIN = `
  SELECT f.id, f.requested_by, f.requested_by_email, f.faculty_name, f.library_id_no,
         f.branch_id, b.branch_name, f.books_required_for, f.semester, f.book_author,
         f.book_title, f.publisher, f.required_quantity, f.student_strength, f.book_type,
         f.remarks, f.status, f.created_at, f.updated_at
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
  publisher: row.publisher,
  requiredQuantity: Number(row.required_quantity),
  studentStrength: Number(row.student_strength),
  bookType: row.book_type,
  remarks: row.remarks || '',
  status: row.status,
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

    const rows = await prisma.$queryRawUnsafe(
      `INSERT INTO public.faculty_book_indent_forms
        (requested_by, requested_by_email, faculty_name, library_id_no, branch_id,
         books_required_for, semester, book_author, book_title, publisher,
         required_quantity, student_strength, book_type, remarks, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'Pending', NOW(), NOW())
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
      String(publisher).trim(),
      quantity,
      strength,
      bookType,
      remarks ? String(remarks).trim() : null
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
    if (existing[0].status !== 'Pending') {
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
           book_author = $6, book_title = $7, publisher = $8, required_quantity = $9,
           student_strength = $10, book_type = $11, remarks = $12, updated_at = NOW()
       WHERE id = $1`,
      Number(id),
      String(libraryIdNo).trim(),
      Number(branchId),
      booksRequiredFor,
      semester,
      String(bookAuthor).trim(),
      String(bookTitle).trim(),
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
    if (existing[0].status !== 'Pending') {
      return res.status(400).json({ message: 'Only pending book indents can be deleted' });
    }

    await prisma.$queryRawUnsafe(`DELETE FROM public.faculty_book_indent_forms WHERE id = $1`, Number(id));

    res.json({ success: true, message: 'Book indent deleted successfully' });
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
};
