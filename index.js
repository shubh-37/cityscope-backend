const express =require('express');
const app = express();
require("dotenv").config();
const cors = require("cors");
const { usersRoutes } = require('./controllers/users');
const { postsRoutes } = require('./controllers/posts');
const connectDB = require('./db-connect');

app.use(express.json());
app.use(cors());
app.get('/', (req, res) => {
  res.send('Server is running');
});
try {
  async function start() {
    const { Models } = await connectDB();
    usersRoutes(app, Models);
    postsRoutes(app, Models);
    app.listen(process.env.PORT || 3000, console.log(`server listening on port:${process.env.PORT || 3000}`));
  }
  start();
} catch (error) {
  console.error("Sorry! Cannot start the server!", error);
}