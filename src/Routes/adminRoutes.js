const express = require("express");
const multer = require('multer');
const { getIndicesAction, insertStocksFromCsvAction } = require("../Controller/AdminController");


const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.get("/index", getIndicesAction)
router.post("/stocks/insert", upload.single("file"), insertStocksFromCsvAction);

module.exports = router;
