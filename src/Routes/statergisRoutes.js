const express = require("express");
const { addNewStatergyAction, removeRunningStatergisAction, getRunningStatergiesAction } = require("../Controller/StatergiesController");

const router = express.Router();

router.use(express.json());

router.get("/runningstatergislist", getRunningStatergiesAction)
router.post("/add", addNewStatergyAction);
router.post("/stop", removeRunningStatergisAction);

module.exports = router;