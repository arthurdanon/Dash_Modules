const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const siteRoutes = require('./routes/sites');
const roleRoutes = require('./routes/roles');
const planRoutes = require('./routes/plans');


const app = express();
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api', userRoutes);
app.use('/api', siteRoutes);
app.use('/api', roleRoutes);
app.use('/api', planRoutes);


const port = 4000;
app.listen(port, () => console.log(`API on http://localhost:${port}`));
