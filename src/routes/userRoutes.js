const express=require('express');
const router=express.Router();
const {addOrUpdateUser,getLeaderboard } = require('../controllers/userContriller');

router.post('/users',addOrUpdateUser);
router.get('/users',getLeaderboard);


module.exports=router;
