// Point d'entrée Vercel : toutes les adresses /api/* et /uploads/* arrivent ici (voir vercel.json).
// Les fichiers de public/ sont servis directement par Vercel.
import { handler } from '../server/app.js';
export default handler;
