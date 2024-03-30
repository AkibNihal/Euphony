const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcrypt");
const { getToken } = require("../utils/helpers");

// This POST route will help to register user
router.post("/register", async (req, res) => {
	// this is run when /register api is called as POST req.
	const { email, password, firstName, lastName, userName } = req.body;

	// if email already exists throw error
	const user = await User.findOne({ email: email });
	if (user) {
		return res.status(403).json({ error: "A user with this email already exists." });
	}
	// if user not found then this is a valid request.

	// create new user in DB
	const hashedPassword = await bcrypt.hash(password, 10);
	const newUserData = { email, password: hashedPassword, firstName, lastName, userName };
	const newUser = await User.create(newUserData);

	// create the token to return to user
	const token = await getToken(email, newUser);
	const userToReturn = { ...newUser.toJSON(), token };
	delete userToReturn.password;
	return res.json(userToReturn);
});

router.post("/login", async (req, res) => {
	// get email pass
	const { email, password } = req.body;

	// check if valid creadentials
	const user = await User.findOne({ email: email });
	if (!user) {
		return res.status(403).json({ err: "Invalid credentials" });
	}

	// check pass
	const isPasswordValid = await bcrypt.compare(password, user.password);
	if (!isPasswordValid) {
		return res.status(403).json({ err: "Invalid credentials" });
	}

	// if all ok return user token
	const token = await getToken(user.email, user);
	const userToReturn = { ...user.toJSON(), token };
	delete userToReturn.password;
	return res.json(userToReturn);
});

module.exports = router;
