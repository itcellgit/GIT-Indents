const departments = [
  { name: 'Aeronautical Engineering', shortName: 'AE' },
  { name: 'Architecture', shortName: 'Arch' },
  { name: 'B Design', shortName: 'B Des' },
  { name: 'Centre for English Excellence', shortName: 'CE' },
  { name: 'Chemistry', shortName: 'Chem' },
  { name: 'Civil Engineering', shortName: 'CE' },
  { name: 'Civil Maintenance', shortName: 'CM' },
  { name: 'Computer Center', shortName: 'CC' },
  { name: 'Computer Science AI ML', shortName: 'AIML' },
  { name: 'Computer Science and Engineering', shortName: 'CSE' },
  { name: 'Electronics and Communication Engineering', shortName: 'ECE' },
  { name: 'Electrical and Electronics Engineering', shortName: 'EEE' },
  { name: 'Exam Section', shortName: 'EX' },
  { name: 'Information Science & Engineering', shortName: 'ISE' },
  { name: 'IT Cell', shortName: 'IT Ce' },
  { name: 'KLS GIT', shortName: 'KLS' },
  { name: 'Language', shortName: 'Lang' },
  { name: 'Library', shortName: 'Libr' },
  { name: 'Master of Business Administration', shortName: 'MBA' },
  { name: 'Master of Computer Applications', shortName: 'MCA' },
  { name: 'Mathematics', shortName: 'Math' },
  { name: 'Mechanical Engineering', shortName: 'ME' },
  { name: 'Office', shortName: 'Offi' },
  { name: 'Physics', shortName: 'Phys' },
  { name: 'Placement', shortName: 'Plac' },
  { name: 'Sports', shortName: 'Spor' },
  { name: 'Vehicle Maintenance', shortName: 'Veh' }
];

const getDepartmentShortName = (name) => {
  const dept = departments.find(d => d.name === name);
  return dept ? dept.shortName : (name ? name.substring(0, 3).toUpperCase() : 'UNK');
};

module.exports = { departments, getDepartmentShortName };
