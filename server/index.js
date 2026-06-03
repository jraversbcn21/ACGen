import express from 'express';
import cors from 'cors';
import { jiraRoutes } from './jiraRoutes.js';

const app = express();
const PORT = 3001;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/jira', jiraRoutes);

app.listen(PORT, () => {
  console.log(`ACGen proxy server running on http://localhost:${PORT}`);
});
