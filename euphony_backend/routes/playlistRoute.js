const express = require("express");
const router = express.Router();
const passport = require("passport");
const Playlist = require("../models/Playlist");
const User = require("../models/User");
const Song = require("../models/Song");
const BasicRecommendation = require("../models/BasicRecommendation");
const TextRecommendation = require("../models/TextRecommendation");
const WeatherRecommendation = require("../models/WeatherRecommendation");

// create playlist
router.post("/create", passport.authenticate("jwt", { session: false }), async (req, res) => {
	const currentUser = req.user;
	const { name, thumbnail, songs } = req.body;

	if (!name || !thumbnail || !songs) {
		return res.status(301).json({ err: "Insufficient data" });
	}

	const playlistData = {
		name,
		thumbnail,
		songs,
		owner: currentUser._id,
		collaborators: [],
	};
	const playlist = await Playlist.create(playlistData);
	return res.status(200).json(playlist);
});

// get playlist by id
router.get("/get/playlist/:playlistId", passport.authenticate("jwt", { session: false }), async (req, res) => {
	const playlistId = req.params.playlistId;
	// find the playlist using the id
	const playlist = await Playlist.findOne({ _id: playlistId }).populate({
		path: "songs",
		populate: {
			path: "artist",
		},
	});
	if (!playlist) {
		return res.status(301).json({ err: "Invalid ID" });
	}
	return res.status(200).json(playlist);
});

// get all playlist made by me
router.get("/get/me", passport.authenticate("jwt", { session: false }), async (req, res) => {
	const artistId = req.user._id;

	const playlists = await Playlist.find({
		owner: artistId,
		name: { $not: { $regex: /^RecommendedPlaylist/i } }, // Exclude playlists with names starting with "RecommendedPlaylist"
	}).populate("owner");

	return res.status(200).json({ data: playlists });
});

// get all playlist made by an artist
router.get("/get/artist/:artistId", passport.authenticate("jwt", { session: false }), async (req, res) => {
	const artistId = req.params.artistId;
	const playlists = await Playlist.find({ owner: artistId });

	const artist = await User.findOne({ _id: artistId });
	if (!artist) {
		return res.status(304).json({ err: "Invalid Artist" });
	}

	return res.status(200).json({ data: playlists });
});

// Add song to playlist
router.post("/add/song", passport.authenticate("jwt", { session: false }), async (req, res) => {
	const currentUser = req.user;
	const { playlistId, songId } = req.body;

	// check if playlist exists
	const playlist = await Playlist.findOne({ _id: playlistId });
	if (!playlist) {
		return res.status(304).json({ err: "Playlist not found" });
	}

	// check if the user has permission to add song to the playlist
	if (!playlist.owner.equals(currentUser._id) && !playlist.collaborators.includes(currentUser._id)) {
		return res.status(400).json({ err: "Not allowed" });
	}

	// check if song exists
	const song = await Song.findOne({ _id: songId });
	if (!song) {
		return res.status(304).json({ err: "Song does not exist!" });
	}

	playlist.songs.push(songId);
	await playlist.save();

	return res.status(200).json(playlist);
});

// get the liked recommended playlist.
router.get("/getRecommendation", passport.authenticate("jwt", { session: false }), async (req, res) => {
    try {
      // Find BasicRecommendation for the current user with playlist population
      const basicRecommendation = await BasicRecommendation.findOne({ user: req.user._id });
      
      if (!basicRecommendation) {
          return res.status(404).json({ error: "BasicRecommendation not found for the user" });
        }
        
        // Extract playlist data
        const playlistData = {
            playlist1: await Playlist.findById(basicRecommendation.playlist1),
            playlist2: await Playlist.findById(basicRecommendation.playlist2),
            playlist3: await Playlist.findById(basicRecommendation.playlist3),
            playlist4: await Playlist.findById(basicRecommendation.playlist4),
            playlist5: await Playlist.findById(basicRecommendation.playlist5),
        };
        console.log(playlistData)
        
      return res.status(200).json({ data: playlistData });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  });
  
// get text recommended playlist
router.get("/getTextRecommendation", passport.authenticate("jwt", { session: false }), async (req, res) => {
	try {
		// Find TextRecommendation for the current user
		const textRecommendation = await TextRecommendation.findOne({ user: req.user._id });

		if (!textRecommendation) {
			return res.status(404).json({ error: "TextRecommendation not found for the user" });
		}

		// Populate each playlist with the actual playlist data
		const populatedRecommendation = await TextRecommendation.populate(textRecommendation, {
			path: "playlist1 playlist2 playlist3 playlist4 playlist5",
			model: "Playlist",
		});

		// Extract playlist data
		const playlistData = {
			playlist1: populatedRecommendation.playlist1,
			playlist2: populatedRecommendation.playlist2,
			playlist3: populatedRecommendation.playlist3,
			playlist4: populatedRecommendation.playlist4,
			playlist5: populatedRecommendation.playlist5,
		};

		return res.status(200).json({ data: playlistData });
	} catch (error) {
		console.error(error);
		return res.status(500).json({ error: "Internal Server Error" });
	}
});

// get weather recommended playlist
router.get("/getWeatherRecommendation", passport.authenticate("jwt", { session: false }), async (req, res) => {
	try {
		// Find TextRecommendation for the current user
		const weatherRecommendation = await WeatherRecommendation.findOne({ user: req.user._id });
        console.log(weatherRecommendation)

		if (!weatherRecommendation) {
			return res.status(404).json({ error: "WeatherRecommendation not found for the user" });
		}

		// Populate each playlist with the actual playlist data
		const populatedRecommendation = await WeatherRecommendation.populate(weatherRecommendation, {
			path: "playlist1 playlist2 playlist3 playlist4 playlist5",
			model: "Playlist",
		});

		// Extract playlist data
		const playlistData = {
			playlist1: populatedRecommendation.playlist1,
			playlist2: populatedRecommendation.playlist2,
			playlist3: populatedRecommendation.playlist3,
			playlist4: populatedRecommendation.playlist4,
			playlist5: populatedRecommendation.playlist5,
		};

		return res.status(200).json({ data: playlistData });
	} catch (error) {
		console.error(error);
		return res.status(500).json({ error: "Internal Server Error" });
	}
});

module.exports = router;
