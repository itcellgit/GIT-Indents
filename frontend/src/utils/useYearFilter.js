import { useMemo, useState } from 'react';

// Year filter shared by the dashboards' stat cards and indent lists.
// Defaults to the current year; 'All' means every year. Options are built from the
// items' own dates (plus the current year) so a new year appears automatically.
// An item belongs to the year it was raised in (createdAt by default).

export const currentYear = () => String(new Date().getFullYear());

// Distinct years (newest first) across one or more lists, always including the current year.
export const buildYearOptions = (lists, dateKey = 'createdAt') => {
  const years = new Set([new Date().getFullYear()]);
  lists.forEach((list) => (list || []).forEach((item) => {
    const value = new Date(item?.[dateKey]).getFullYear();
    if (!Number.isNaN(value)) years.add(value);
  }));
  return [...years].sort((a, b) => b - a);
};

export const filterByYear = (items, year, dateKey = 'createdAt') => {
  const list = items || [];
  if (year === 'All') return list;
  return list.filter((item) => new Date(item?.[dateKey]).getFullYear() === Number(year));
};

// Still being worked on: not Completed and not Rejected.
export const isOpenIndent = (item) => {
  const status = String(item?.status || '');
  return status !== 'Completed' && !status.startsWith('Rejected');
};

// For work lists: the selected year's items plus any older item that is still open,
// so unfinished work never drops out of view when the year changes.
export const withOpenCarryOver = (items, year, dateKey = 'createdAt') => {
  const list = items || [];
  if (year === 'All') return list;
  return list.filter((item) => new Date(item?.[dateKey]).getFullYear() === Number(year) || isOpenIndent(item));
};

// The year an item was raised in when it is outside the selected year (a carried-over
// open item), otherwise null. Used to tag such rows in the table.
export const carriedOverYear = (item, year, dateKey = 'createdAt') => {
  if (!year || year === 'All') return null;
  const value = new Date(item?.[dateKey]).getFullYear();
  return !Number.isNaN(value) && value !== Number(year) ? value : null;
};

// Single-list convenience hook.
export default function useYearFilter(items, dateKey = 'createdAt') {
  const [year, setYear] = useState(currentYear);
  const yearOptions = useMemo(() => buildYearOptions([items], dateKey), [items, dateKey]);
  const yearItems = useMemo(() => filterByYear(items, year, dateKey), [items, year, dateKey]);
  return { year, setYear, yearOptions, yearItems };
}
