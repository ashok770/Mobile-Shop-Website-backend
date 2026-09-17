import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();
const token = jwt.sign({ id: 'dummy', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
console.log(token);
