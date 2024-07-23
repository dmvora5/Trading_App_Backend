const express = require("express");
const { addNewStatergyAction, removeRunningStatergisAction, getRunningStatergiesAction, getAllStatergiesNameAction } = require("../Controller/StatergiesController");

const router = express.Router();

router.use(express.json());

router.get("/statergies-name", getAllStatergiesNameAction)

router.get("/runningstatergislist", getRunningStatergiesAction)
router.post("/add", addNewStatergyAction);
router.post("/stop", removeRunningStatergisAction);

module.exports = router;