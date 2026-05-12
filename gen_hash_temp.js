
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('admin@1208', 10);
console.log(hash);
