import { promisify } from 'util';
import jwt from 'jsonwebtoken';
import authConfig from '../../config/auth';

export default async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Tocken not provider' });
  }
  const [, token] = authHeader.split(' ');
  try {
    /* O promisify é uma função do node, que transforma funções com callback
    em funções que possam ser usadas com async/await. */

    const decoded = await promisify(jwt.verify)(token, authConfig.apiKey);
    req.userId = decoded.id;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Tocken not invalid' });
  }
};
