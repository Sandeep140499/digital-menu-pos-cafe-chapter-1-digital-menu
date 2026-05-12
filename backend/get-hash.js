const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('admin@1208', 10);
console.log('=== HASH FOR admin@1208 ===');
console.log(hash);
console.log('===========================');
