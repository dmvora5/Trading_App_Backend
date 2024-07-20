require('dotenv').config();


const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");



const db = require("./src/Config/DatabaseConnect");
const { configureSocket } = require('./src/Events/socket');
const { errorHandler } = require('./src/Middlewares/errorHandlingMiddleware');

//routes
const statergiesRoute = require("./src/Routes/statergisRoutes");
const adminRoutes = require("./src/Routes/adminRoutes")


//end section

const whiteList = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
];


const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: whiteList } });

const corsOptions = {
    origin: (origin, callback) => {
        if (whiteList.indexOf(origin) !== -1) {
            callback(null, true);
        } else {

            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true, // enable set cookie
    optionsSuccessStatus: 200,
};

// app.use(cors(corsOptions));

configureSocket(io);


app.use("/api/v1/statergies", statergiesRoute);
app.use("/api/v1/admin", adminRoutes)

app.use(errorHandler);

db.once('open', async () => {
    server.listen(process.env.PORT, () => {
        console.log(`server is running on port ${process.env.PORT}`);
    });
});

db.on('error', console.error.bind(console, 'MongoDB connection error:'));