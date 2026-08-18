import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Download, Menu, X, ChevronRight, CheckCircle2, Bell, FileSpreadsheet,
  UserCog, Wrench, CalendarDays, BookOpen, ClipboardList, Info
} from 'lucide-react';
import logo from '../../assets/logo.png';

const NAV_SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'getting-started', label: 'Getting started' },
  { id: 'roles', label: 'Roles & access' },
  { id: 'maintenance', label: 'SOP · Maintenance indents' },
  { id: 'bookings', label: 'SOP · Bookings' },
  { id: 'library', label: 'SOP · Library indents' },
  { id: 'stationery', label: 'SOP · Stationery' },
  { id: 'everyday', label: 'Everyday features' },
  { id: 'dashboards', label: 'Dashboard reference' },
  { id: 'faq', label: 'Troubleshooting & FAQ' },
];

const MODULES = [
  { icon: Wrench, name: 'Maintenance Indents', desc: "Report a facility/IT problem or request new work. Routed to the category's Facility Provider for approval, then to an assigned maintainer." },
  { icon: CalendarDays, name: 'Resource Bookings', desc: 'Reserve halls, vehicles, and buses on a shared calendar, approved by the team that owns that resource.' },
  { icon: BookOpen, name: 'Library Book Indents', desc: 'Faculty request books; the Library HOD sees every request in a read-only, filterable list.' },
  { icon: ClipboardList, name: 'Stationery Requests', desc: 'Designated coordinators request stationery items; Office_Stationary fulfils them from a shared catalog.' },
];

const ROLE_DIRECTORY = [
  ['Faculty', "Raises maintenance indents, books halls/vehicles/buses, requests library books; may also handle stationery if designated Stationary Coordinator."],
  ['Non-Teaching', 'Same as Faculty, minus library book requests.'],
  ['HOD', "Does not approve or reject indents — that sits with the Facility Provider. Can still assign an existing Maintainer to an already-approved indent, manages Stationary Coordinators, and (Library HOD) manages library branches and views submitted book indents."],
  ['Facility Provider', "The role that approves or rejects maintenance indents, for the categories they're incharge of. The only role that adds or removes department staff as Maintainer."],
  ['Admin', 'Manages departments, users, roles, coordinators, branches; system-wide indent visibility (read-only) and reporting.'],
  ['Principal', 'Read-only, system-wide visibility into every indent via the Global Queue, plus reports and user management. Does not approve or reject indents — that sits with the Facility Provider.'],
  ['Maintainer', 'Executes assigned maintenance work, logs materials/duration, marks work complete.'],
  ['Office_Stationary', 'Manages the stationery item catalog and processes stationery requests.'],
  ['Receptionist', 'Manages hall and vehicle inventory and bookings.'],
  ['Transport', 'Manages bus inventory and bookings.'],
];

const STATUS_TABLE = [
  ['Indent Created', 'neutral', 'Submitted, awaiting the Facility Provider incharge of the category.'],
  ['Rejected by Maintenance HOD', 'danger', 'Rejected by the Facility Provider. Visible read-only to the Principal in the Global Queue; the Facility Provider can still revisit and approve it later.'],
  ['Approved by Maintenance HOD', 'info', 'Ready for assignment.'],
  ['In Progress', 'warning', 'Assigned and being worked — in-house or by a Maintainer.'],
  ['Completed', 'success', 'Maintainer finished the work; requester notified. Terminal.'],
];

const DASHBOARD_REFERENCE = [
  ['Faculty', 'Raise indents; stats + searchable/filterable indent list; quick links to Hall/Vehicle/Bus booking, Book Indent, and Stationary Indent (if coordinator).'],
  ['Non-Teaching', 'Same as Faculty, minus Book Indent.'],
  ['HOD', 'Raised Indents, Indents Raised for Dept (if the dept has Facility Providers), My Raised Indents, Stationary Coordinator, Bookings, and (Library HOD only) Branches / Book Indents. No indent approve/reject.'],
  ['Facility Provider', 'Approval Queue + Maintenance Queue (if incharge of a category), My Raised Indents, Manage Maintainers — no Stationary Coordinator tab or Bookings menu.'],
  ['Admin', 'Departments, Indents (analytics, read-only), Reports, Users (incl. bulk upload), Stationary Coordinator, Role MGT, Branch MGT.'],
  ['Principal', 'Global Queue (read-only view of every indent), My Raised Indents, System Reports, User Management, plus Raise Indent.'],
  ['Maintainer', 'Approval Queue, Your Tasks, stats for In Progress / Pending Verification / Completed, plus a link to the E-Tendering portal.'],
  ['Office_Stationary', 'Stationery Master (catalog), Processing Requests (review/grant).'],
  ['Receptionist', 'Full Hall and Vehicle inventory and booking management.'],
  ['Transport', 'Full Bus inventory and booking management.'],
];

const FAQ = [
  ["I can't see the Stationary Indent link on my dashboard.", 'It only appears once your HOD has added you as a Stationary Coordinator (via Manage Coordinator Staffs), or Admin has done so via Stationary Coordinator management. Ask your HOD to designate you.'],
  ["Why can't I mark an indent as Completed?", 'Only the Maintainer assigned to that indent can select Complete Work. A Facility Provider can approve, assign, and verify — but not close it themselves. The Principal has read-only oversight and does not action indents directly.'],
  ["My booking was rejected as a conflict, but I don't see an overlapping booking.", 'The conflict check includes any booking on that resource that is still Pending, not only Approved ones. Check with the owning team — Receptionist for Halls/Vehicles, Transport for Buses.'],
  ['Can I edit a stationery request after Office_Stationary has started processing it?', 'No — once any item on the request has a granted quantity, editing and deleting are disabled. Your only remaining action is Mark as received.'],
  ['I hold two roles. How do I switch between them?', 'Open your Profile page and use the Role Switch control. You do not need to log out and back in.'],
  ["I didn't receive my OTP email.", "Check spam/junk first. OTPs are time-limited — if it's expired, request a new one. If emails aren't arriving at all, contact itcell@git.edu."],
];

const PILL_STYLES = {
  neutral: 'bg-gray-100 text-gray-600',
  info: 'bg-blue-50 text-blue-700',
  success: 'bg-green-50 text-green-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
};

const Pill = ({ tone, children }) => (
  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${PILL_STYLES[tone]}`}>
    {children}
  </span>
);

const Section = ({ id, eyebrow, title, dek, children }) => (
  <section id={id} className="scroll-mt-24 py-14 border-b border-gray-100 last:border-b-0">
    {eyebrow && <p className="text-xs font-bold tracking-widest uppercase text-brand-purple mb-2">{eyebrow}</p>}
    <h2 className="text-2xl md:text-3xl font-bold text-gray-900">{title}</h2>
    {dek && <p className="mt-3 text-gray-500 max-w-2xl leading-relaxed">{dek}</p>}
    <div className="mt-8">{children}</div>
  </section>
);

const Steps = ({ items }) => (
  <ol className="space-y-6">
    {items.map((s, i) => (
      <li key={i} className="relative pl-12">
        <span className="absolute left-0 top-0 w-8 h-8 rounded-full bg-brand-dark text-white text-sm font-bold flex items-center justify-center">{i + 1}</span>
        <p className="font-semibold text-gray-900">{s.t}</p>
        <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{s.d}</p>
      </li>
    ))}
  </ol>
);

const Callout = ({ children, tone = 'note' }) => (
  <div className={`rounded-xl border p-4 text-sm leading-relaxed ${tone === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-brand-light/60 border-brand/20 text-gray-700'}`}>
    {children}
  </div>
);

const UserGuide = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-brand-dark text-white print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-white/10"
              aria-label="Open contents menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center overflow-hidden shrink-0">
              <img src={logo} alt="KLS GIT Logo" className="w-6 h-6 object-contain" />
            </div>
            <span className="font-bold truncate">GIT Indent Portal — User Guide</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePrint}
              className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              <Download className="w-4 h-4" /> Download PDF
            </button>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg bg-white text-brand-dark hover:bg-blue-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Back to Login</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile contents drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden print:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl p-5 overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <span className="font-bold text-gray-900">Contents</span>
              <button onClick={() => setMenuOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="space-y-1">
              {NAV_SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-between text-sm text-gray-600 hover:text-brand-dark hover:bg-brand-light/60 rounded-lg px-3 py-2"
                >
                  {s.label} <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                </a>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Hero */}
      <div className="bg-brand-dark text-white print:bg-white print:text-black">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-16">
          <p className="text-xs font-bold tracking-widest uppercase text-blue-200 print:text-gray-500 mb-4">User Guide &amp; Standard Operating Procedures</p>
          <h1 className="text-3xl md:text-4xl font-extrabold max-w-2xl leading-tight">One login for every indent, booking, and request on campus.</h1>
          <p className="mt-4 text-blue-100 print:text-gray-600 max-w-2xl leading-relaxed">
            KLS Gogte Institute of Technology, Belagavi. This guide explains what the GIT Indent Management Portal does and exactly how to use it, role by role.
          </p>
          <div className="mt-8 flex flex-wrap gap-8 border-t border-white/15 print:border-gray-200 pt-6">
            {[['Workflows', '4'], ['Roles', '10'], ['Shared login', '1']].map(([k, v]) => (
              <div key={k} className="text-xs text-blue-200 print:text-gray-500">
                {k}
                <div className="text-2xl font-bold text-white print:text-black mt-0.5">{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-10">
        {/* Desktop side nav */}
        <nav className="hidden lg:block sticky top-24 self-start py-14 print:hidden">
          <p className="text-xs font-bold tracking-widest uppercase text-gray-400 mb-3">Contents</p>
          <div className="space-y-1">
            {NAV_SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="block text-sm text-gray-500 hover:text-brand-dark hover:bg-brand-light/60 rounded-lg px-3 py-1.5 transition-colors">
                {s.label}
              </a>
            ))}
          </div>
        </nav>

        <main className="min-w-0">
          <Section id="overview" eyebrow="Overview" title="What's inside" dek="Every module shares the same login, in-app notifications, and Excel/PDF reporting.">
            <div className="grid sm:grid-cols-2 gap-4">
              {MODULES.map((m) => (
                <div key={m.name} className="rounded-2xl border border-gray-200 p-5 hover:border-brand/40 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-brand-light flex items-center justify-center mb-3">
                    <m.icon className="w-5 h-5 text-brand-dark" />
                  </div>
                  <p className="font-bold text-gray-900">{m.name}</p>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">{m.desc}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="getting-started" eyebrow="Getting started" title="Accounts, login & passwords">
            <Callout>
              <strong>There is no self-registration.</strong> Every account is created by the IT Cell. If you're a new user, email <a href="mailto:itcell@git.edu" className="font-semibold text-brand-dark underline underline-offset-2">itcell@git.edu</a> with your name, role, and department to get your account and login credentials.
            </Callout>
            <div className="mt-6">
              <Steps items={[
                { t: 'Request an account', d: 'Email itcell@git.edu with your name, role, and department. IT Cell creates your account and shares your login credentials.' },
                { t: 'Log in', d: "Enter your email and password on the Login page — you'll land on your role's dashboard." },
              ]} />
            </div>
            <p className="mt-6 text-sm text-gray-500 leading-relaxed">
              <strong className="text-gray-900">Forgot password:</strong> use "Forgot password" on the Login page — an OTP is emailed to reset it.{' '}
              <strong className="text-gray-900">Change password:</strong> use the password icon in the dashboard header, available on every screen once logged in.
            </p>
          </Section>

          <Section id="roles" eyebrow="Roles & access" title="Who does what" dek="A role controls exactly what a person can see and do. A user can hold more than one role and switch between them from their Profile page.">
            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-4 py-3 font-bold text-gray-900 w-40">Role</th>
                    <th className="px-4 py-3 font-bold text-gray-900">What they're for</th>
                  </tr>
                </thead>
                <tbody>
                  {ROLE_DIRECTORY.map(([role, desc]) => (
                    <tr key={role} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-semibold text-gray-900 align-top">{role}</td>
                      <td className="px-4 py-3 text-gray-600 align-top leading-relaxed">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="maintenance" eyebrow="Standard Operating Procedure" title="Maintenance indents" dek="Report an issue or request new work, and track it through approval, assignment, and completion.">
            <Callout>
              <strong>Approval sits with one role:</strong> the Facility Provider incharge of the target maintenance category is the sole approver. Neither HOD nor Principal approves or rejects indents — the Principal has read-only visibility into every indent via the Global Queue, for oversight only.
            </Callout>
            <div className="mt-6">
              <Steps items={[
                { t: 'Raise it', d: 'Faculty, Non-Teaching, HOD, or Principal fill in category, location, nature of work, description, and an optional photo. Status starts at Indent Created.' },
                { t: 'Facility Provider reviews', d: 'The Facility Provider incharge of the category approves or rejects it — a reason is required to reject. An indent raised by that same Facility Provider is auto-approved.' },
                { t: 'Principal oversight (read-only)', d: 'The Principal can see every indent in the Global Queue for oversight.' },
                { t: 'Assignment', d: 'Once approved, the Facility Provider starts an in-house assignment or assigns it to a Maintainer. Only a Facility Provider can add/remove the Maintainer role itself.' },
                { t: 'Execution', d: 'The Maintainer logs workers, duration, remarks, and materials, then selects Complete Work — restricted to the assigned Maintainer only.' },
                { t: 'Verification & close', d: 'Completing the work notifies the requester; the Status Timeline records every transition with a timestamp.' },
              ]} />
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-2 text-sm">
              {['Indent Created', 'Approved by Maintenance HOD', 'In Progress', 'Completed'].map((s, i, arr) => (
                <React.Fragment key={s}>
                  <span className="px-3 py-1.5 rounded-lg border border-gray-200 font-semibold text-gray-700 bg-gray-50">{s}</span>
                  {i < arr.length - 1 && <ChevronRight className="w-4 h-4 text-gray-300" />}
                </React.Fragment>
              ))}
            </div>
            <div className="mt-6 overflow-x-auto rounded-2xl border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-4 py-3 font-bold text-gray-900 w-64">Status</th>
                    <th className="px-4 py-3 font-bold text-gray-900">Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  {STATUS_TABLE.map(([label, tone, meaning]) => (
                    <tr key={label} className="border-t border-gray-100">
                      <td className="px-4 py-3 align-top"><Pill tone={tone}>{label}</Pill></td>
                      <td className="px-4 py-3 text-gray-600 align-top leading-relaxed">{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="bookings" eyebrow="Standard Operating Procedure" title="Resource bookings — Hall, Vehicle, Bus" dek="Faculty, Non-Teaching, and HOD users can book shared resources. Facility Provider does not see a Bookings menu.">
            <Steps items={[
              { t: 'Pick a date', d: 'Use the month calendar or the Today/Tomorrow panel.' },
              { t: 'Fill the booking form', d: 'Purpose, booked-by name/email — plus destination, passengers, and time window for Vehicle and Bus.' },
              { t: 'Conflict check', d: 'Overlapping a Pending or Approved booking on the same resource blocks submission with a named conflict warning.' },
              { t: 'Owning team reviews', d: 'Receptionist approves Hall/Vehicle bookings; Transport approves Bus bookings. An approved booking can no longer be edited or cancelled by the requester.' },
            ]} />
          </Section>

          <Section id="library" eyebrow="Standard Operating Procedure" title="Library book indents" dek="Faculty request books through Book Indent; the Library HOD sees every request in one place.">
            <Callout>
              <strong>There's no approve/reject step.</strong> The Library HOD's Book Indents screen is a read-only, filterable list of every request — there is no approve, reject, order, or received action anywhere in the app today. A request simply stays at Pending once submitted.
            </Callout>
            <div className="mt-6">
              <Steps items={[
                { t: 'Submit a request', d: "Branch, semester, book type, title, author, publisher, required quantity, student strength. The requester can edit or delete it themselves while it's still Pending." },
                { t: 'Library HOD reviews the list', d: 'The Library HOD sees every submitted request, filterable by branch and degree, for reference — there is no action to take on it in-app.' },
              ]} />
            </div>
          </Section>

          <Section id="stationery" eyebrow="Standard Operating Procedure" title="Stationery requests" dek="A designated Stationary Coordinator requests items; Office_Stationary fulfils them from a shared catalog.">
            <Callout>
              Only Faculty/Non-Teaching users designated <strong>Stationary Coordinator</strong> — by their HOD, or by Admin — see the Stationary Indent link.
            </Callout>
            <div className="mt-6">
              <Steps items={[
                { t: 'Create a request', d: 'Enter a reason, then add one or more items with quantities. Submitting sets status to Pending.' },
                { t: 'Edit or delete, if needed', d: 'Only while still pending and no item has been granted a quantity yet.' },
                { t: 'Office_Stationary grants it', d: 'Enters a Given Date and a Grant Quantity per item from the Processing Requests tab.' },
                { t: 'Mark as received', d: 'Appears once at least one item is granted; selecting it closes the request.' },
              ]} />
            </div>
          </Section>

          <Section id="everyday" eyebrow="Shared across every role" title="Notifications, reports & profile">
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-gray-200 p-5">
                <Bell className="w-5 h-5 text-brand-dark mb-2" />
                <p className="font-bold text-gray-900">Notifications</p>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">The bell icon shows an unread count; clicking one jumps straight to the related indent or request.</p>
              </div>
              <div className="rounded-2xl border border-gray-200 p-5">
                <FileSpreadsheet className="w-5 h-5 text-brand-dark mb-2" />
                <p className="font-bold text-gray-900">Reports</p>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">Admin and Principal filter by month/year/department/status and export to Excel or PDF. Any indent can be printed from its details view.</p>
              </div>
              <div className="rounded-2xl border border-gray-200 p-5">
                <UserCog className="w-5 h-5 text-brand-dark mb-2" />
                <p className="font-bold text-gray-900">Profile</p>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">Review/edit name, email, and department; see assigned role(s); switch active role if you hold more than one.</p>
              </div>
            </div>
          </Section>

          <Section id="dashboards" eyebrow="Quick reference" title="Dashboard by role">
            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-4 py-3 font-bold text-gray-900 w-40">Role</th>
                    <th className="px-4 py-3 font-bold text-gray-900">Dashboard highlights</th>
                  </tr>
                </thead>
                <tbody>
                  {DASHBOARD_REFERENCE.map(([role, desc]) => (
                    <tr key={role} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-semibold text-gray-900 align-top">{role}</td>
                      <td className="px-4 py-3 text-gray-600 align-top leading-relaxed">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="faq" eyebrow="Support" title="Troubleshooting & FAQ">
            <div className="space-y-3">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group rounded-xl border border-gray-200 px-4 py-1 open:pb-3">
                  <summary className="cursor-pointer list-none flex items-center justify-between py-3 font-semibold text-gray-900 text-sm">
                    {q}
                    <ChevronRight className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform shrink-0 ml-3" />
                  </summary>
                  <p className="text-sm text-gray-500 leading-relaxed">{a}</p>
                </details>
              ))}
            </div>
            <div className="mt-6 flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <span>For access any technical issues contact itcell@git.edu.</span>
            </div>
          </Section>

          <div className="pb-16 pt-6 text-xs text-gray-400 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> GIT Indent Management Portal · KLS Gogte Institute of Technology, Belagavi
          </div>
        </main>
      </div>
    </div>
  );
};

export default UserGuide;
