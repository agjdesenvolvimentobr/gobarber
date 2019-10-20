import { Router } from 'express';
import User from './app/models/User';

const routes = new Router();

routes.get('/', (req, res) => {
  return res.json({ message: 'Hello Word!' });
});

routes.get('/user', async (req, res) => {
  const user = await User.create({
    name: 'Amilson Gaspar',
    email: 'agjdesenvilvimento@gmail.com',
    password_hash: 'asdfasdf',
  });
  return res.json(user);
});

export default routes;
