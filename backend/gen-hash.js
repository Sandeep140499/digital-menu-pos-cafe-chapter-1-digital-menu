const bcrypt = require('bcryptjs');

const password = 'Admin@1208';
const hash = bcrypt.hashSync(password, 10);
console.log(hash);
