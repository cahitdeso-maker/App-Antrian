import { auth } from '@/lib/auth';

export const { GET, POST, PUT, PATCH, DELETE } = {
  GET: auth.handler,
  POST: auth.handler,
  PUT: auth.handler,
  PATCH: auth.handler,
  DELETE: auth.handler,
};
