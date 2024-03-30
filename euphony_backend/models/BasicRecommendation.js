const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const BasicRecommendation = new Schema({
	user: {
		type: Schema.Types.ObjectId,
		ref: "User",
		required: true,
	},
	playlist1: {
		type: Schema.Types.ObjectId,
		ref: "Playlist",
	},
	playlist2: {
		type: Schema.Types.ObjectId,
		ref: "Playlist",
	},
	playlist3: {
		type: Schema.Types.ObjectId,
		ref: "Playlist",
	},
	playlist4: {
		type: Schema.Types.ObjectId,
		ref: "Playlist",
	},
	playlist5: {
		type: Schema.Types.ObjectId,
		ref: "Playlist",
	},
});

// create model
const BasicRecommendationModel = mongoose.model("BasicRecommendation", BasicRecommendation);

module.exports = BasicRecommendationModel;
