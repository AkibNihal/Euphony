const mongoose = require("mongoose");

// create schema
const Song = new mongoose.Schema({
	name: {
		type: String,
		required: true,
	},
	thumbnail: {
		type: String,
		required: true,
	},
	track: {
		type: String,
		required: true,
	},
	genre: {
		type: String,
		required: true,
	},
	artist: {
		type: mongoose.Types.ObjectId,
		ref: "User",
	},
});

// create model
const SongModel = mongoose.model("Song", Song);

module.exports = SongModel;
