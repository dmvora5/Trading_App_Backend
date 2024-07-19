require('dotenv').config();


const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");



const db = require("./src/Config/DatabaseConnect");
const { configureSocket } = require('./src/Events/socket');

//sheduler Manager
const schedulerManager = require("./src/SchedulerManager/schedulerManager");


//pending some work




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