const fs = require('fs');
const path = require('path');

const filesToProcess = [
  'controllers/authController.js',
  'controllers/adminController.js',
  'controllers/categoryController.js',
  'controllers/facultyController.js',
  'controllers/hodController.js',
  'middleware/authMiddleware.js',
  'controllers/notificationController.js',
  'controllers/maintainerController.js',
  'utils/notificationService.js'
];

filesToProcess.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const newLines = lines.filter(line => {
      if (line.includes('console.log(') || line.includes('console.error(') || line.includes('console.warn(')) {
        if (line.includes('Generated OTP is:')) {
          return true; // Keep OTP console log
        }
        return false; // Remove other consoles
      }
      return true;
    });
    fs.writeFileSync(filePath, newLines.join('\n'));
    console.log(`Processed ${file}`);
  }
});
