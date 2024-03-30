const express = require("express");
const router = express.Router();
const passport = require("passport");
const Song = require("../models/Song");
const User = require("../models/User");
const Playlist = require("../models/Playlist");
const BasicRecommendation = require("../models/BasicRecommendation");
const TextRecommendation = require("../models/TextRecommendation");
const WeatherRecommendation = require("../models/WeatherRecommendation");
const { spawn } = require("child_process");
const Fuse = require("fuse.js");

router.post("/create", passport.authenticate("jwt", { session: false }), async (req, res) => {
	const { name, thumbnail, track, genre } = req.body;
	if (!name || !thumbnail || !track || !genre) {
		return res.status(301).json({ err: "Insufficient details to create song." });
	}
	const artist = req.user._id;
	const songDetails = { name, thumbnail, track, artist, genre };
	const createdSong = await Song.create(songDetails);
	return res.status(200).json(createdSong);
});

//  get route to gell all songs I have published.
router.get("/get/mysongs", passport.authenticate("jwt", { session: false }), async (req, res) => {
	const songs = await Song.find({ artist: req.user._id }).populate("artist");
	return res.status(200).json({ data: songs });
});

// get song by artist
router.get("/get/artist/:artistId", passport.authenticate("jwt", { session: false }), async (req, res) => {
	const { artistId } = req.params;
	const artist = await User.findOne({ _id: artistId });

	// check if artist exist or not
	if (!artist) {
		return res.status(301).json({ err: "Artist does not exist" });
	}

	const songs = await Song.find({ artist: artistId });
	return res.status(200).json({ data: songs });
});

//get route to get single song by name

// search should support natural language queries
// router.get("/get/songname/:songName", passport.authenticate("jwt", { session: false }), async (req, res) => {
// 	const { songName } = req.params;

// 	// name:songName --> exact name matching. Vanilla, Vanila
// 	// Pattern matching instead of direct name matching.
// 	const songs = await Song.find({ name: songName }).populate("artist");
// 	return res.status(200).json({ data: songs });
// });

router.get("/get/songname/:songName", passport.authenticate("jwt", { session: false }), async (req, res) => {
	try {
		const { songName } = req.params;
		const { genre } = req.query;

		// Fetch all songs from the database
		let query = {};

		// Include genre in the query if provided
		if (genre) {
			query.genre = genre;
		}

		const allSongs = await Song.find(query).populate("artist");

		// Create a new Fuse instance with the songs and fuzzy search options
		const fuseOptions = {
			keys: ["name", "artist.firstName", "artist.lastName"], // Include artist properties for fuzzy matching
			includeScore: true,
		};
		const fuse = new Fuse(allSongs, fuseOptions);

		// Search for songs with fuzzy matching
		const fuzzyResults = fuse.search(songName);

		// Extract the actual results and their scores
		const songsWithScores = fuzzyResults.map((result) => ({
			song: result.item._doc, // Use _doc to get the original document
			score: result.score,
		}));

		return res.status(200).json({ data: songsWithScores });
	} catch (error) {
		console.error(error);
		return res.status(500).json({ error: "Internal Server Error" });
	}
});

// Add this route to your SongRoute code

// Like a song
router.post("/like/:songId", passport.authenticate("jwt", { session: false }), async (req, res) => {
	const { songId } = req.params;

	try {
		const user = await User.findById(req.user._id);

		// Check if the song is already liked by the user
		if (user.likedSongs.includes(songId)) {
			return res.status(400).json({ error: "Song already liked by the user." });
		}

		// Add the song to the likedSongs array
		user.likedSongs.push(songId);
		await user.save();

		return res.status(200).json({ message: "Song liked successfully." });
	} catch (error) {
		console.error(error);
		return res.status(500).json({ error: "Internal Server Error" });
	}
});

// Get liked songs of a user
router.get("/liked", passport.authenticate("jwt", { session: false }), async (req, res) => {
	try {
		const user = await User.findById(req.user._id)
			.populate("likedSongs")
			.populate({
				path: "likedSongs",
				populate: {
					path: "artist",
					model: "User",
				},
			});
		return res.status(200).json({ data: user.likedSongs });
	} catch (error) {
		console.error(error);
		return res.status(500).json({ error: "Internal Server Error" });
	}
});

// create recommendation from liked songs.
router.post("/createRecommendation", passport.authenticate("jwt", { session: false }), async (req, res) => {
	try {
		// Get the liked songs of the user
		const user = await User.findById(req.user._id).populate("likedSongs");
		const likedSongs = user.likedSongs.map((song) => song.name);

		// Execute the Python script and get recommendations
		const recommendationsData = await executePythonScript(likedSongs);

		// Parse the JSON to get the recommendations array
		const recommendations = recommendationsData.recommendations;

		// Filter recommendations based on songs available in the database
		const availableSongs = await Song.find({ name: { $in: recommendations } });
		const filteredRecommendations = availableSongs.map((song) => song.name);

		// Create BasicRecommendation instance
		const basicRecommendation = new BasicRecommendation({
			user: req.user._id,
		});

		// Save BasicRecommendation to the database
		await basicRecommendation.save();

		// Create and add songs to playlists
		const playlists = [];
		for (let i = 0; i < 5; i++) {
			const playlistName = `RecommendedPlaylist${i + 1}`;
			const playlistThumbnail = "https://images.unsplash.com/photo-1593958812614-2db6a598c71c?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8ZGlzY298ZW58MHx8MHx8fDA%3D";

			const playlistData = {
				name: playlistName,
				thumbnail: playlistThumbnail,
				owner: req.user._id,
				collaborators: [],
			};

			// Create a new playlist
			const playlist = await Playlist.create(playlistData);

			// Add songs to the playlist
			const songsPerPlaylist = filteredRecommendations.length >= 10 ? 10 : filteredRecommendations.length;
			for (let j = 0; j < songsPerPlaylist; j++) {
				const songIndex = i * songsPerPlaylist + j;
				playlist.songs.push(availableSongs[songIndex % filteredRecommendations.length]._id);
			}

			// Save the playlist
			await playlist.save();

			// Update BasicRecommendation with the created playlist
			const playlistField = `playlist${i + 1}`;
			basicRecommendation[playlistField] = playlist._id;
			playlists.push(playlist);
		}

		// Save updated BasicRecommendation
		await basicRecommendation.save();

		return res.status(201).json({ data: playlists });
	} catch (error) {
		console.error(error);
		return res.status(500).json({ error: "Internal Server Error" });
	}
});

// creating text recommendations
router.post("/createTextRecommendation", passport.authenticate("jwt", { session: false }), async (req, res) => {
	try {
		// Assuming text is sent in the request body
		const textInput = req.body.text;

		// Execute Python script and get recommendations
		const recommendationsData = await executePythonScript2(textInput);
		const recommendations = recommendationsData.recommendations;

		// Filter recommendations based on songs available in the database
		const availableSongs = await Song.find({ name: { $in: recommendations } });
		const filteredRecommendations = availableSongs.map((song) => song._id);

		// Find the existing TextRecommendation for the user
		let existingTextRecommendation = await TextRecommendation.findOne({ user: req.user._id });

		// Delete existing playlists associated with TextRecommendation
		if (existingTextRecommendation) {
			for (let i = 1; i <= 5; i++) {
				const playlistField = `playlist${i}`;
				const playlistId = existingTextRecommendation[playlistField];
				await Playlist.findByIdAndDelete(playlistId);
			}
		}

		// If there is no existingTextRecommendation, create a new one
		if (!existingTextRecommendation) {
			existingTextRecommendation = new TextRecommendation({ user: req.user._id });
		}

		// Create and save new playlists with the updated recommendations
		const playlists = [];
		if (filteredRecommendations.length >= 50) {
			// Split 10 songs in each of the 5 playlists
			for (let i = 0; i < 5; i++) {
				const playlistName = `RecommendedPlaylist${i + 1}`;
				const playlistThumbnail = "https://images.unsplash.com/photo-1593958812614-2db6a598c71c?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8ZGlzY298ZW58MHx8MHx8fDA%3D";

				const playlistData = {
					name: playlistName,
					thumbnail: playlistThumbnail,
					owner: req.user._id,
					collaborators: [],
				};

				// Create a new playlist
				const playlist = await Playlist.create(playlistData);

				// Add 10 songs to the playlist
				for (let j = 0; j < 10; j++) {
					const songIndex = i * 10 + j;
					playlist.songs.push(filteredRecommendations[songIndex % filteredRecommendations.length]);
				}

				// Save the playlist
				await playlist.save();

				// Update TextRecommendation with the created playlist
				const playlistField = `playlist${i + 1}`;
				existingTextRecommendation[playlistField] = playlist._id;
				playlists.push(playlist);
			}
		} else {
			// Less than 50 recommendations, each playlist can have repetitions
			for (let i = 0; i < 5; i++) {
				const playlistName = `RecommendedPlaylist${i + 1}`;
				const playlistThumbnail = "https://images.unsplash.com/photo-1593958812614-2db6a598c71c?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8ZGlzY298ZW58MHx8MHx8fDA%3D";

				const playlistData = {
					name: playlistName,
					thumbnail: playlistThumbnail,
					owner: req.user._id,
					collaborators: [],
				};

				// Create a new playlist
				const playlist = await Playlist.create(playlistData);

				// Add all recommendations to the playlist
				for (let j = 0; j < filteredRecommendations.length; j++) {
					playlist.songs.push(filteredRecommendations[j]);
				}

				// Save the playlist
				await playlist.save();

				// Update TextRecommendation with the created playlist
				const playlistField = `playlist${i + 1}`;
				existingTextRecommendation[playlistField] = playlist._id;
				playlists.push(playlist);
			}
		}

		// Save updated TextRecommendation
		await existingTextRecommendation.save();

		return res.status(201).json({ data: playlists });
	} catch (error) {
		console.error(error);
		return res.status(500).json({ error: "Internal Server Error" });
	}
});

// creating weather recommendations
router.post("/createWeatherRecommendation", passport.authenticate("jwt", { session: false }), async (req, res) => {
	try {
		// Execute Python script and get recommendations
		const recommendationsData = await executePythonScript3();
		const recommendations = recommendationsData.recommendations;

		// console.log(recommendations);

		// Filter recommendations based on songs available in the database
		const availableSongs = await Song.find({ name: { $in: recommendations } });
		const filteredRecommendations = availableSongs.map((song) => song._id);

		// Find the existing WeatherRecommendation (assuming you have a WeatherRecommendation model)
		let existingWeatherRecommendation = await WeatherRecommendation.findOne({ user: req.user._id });

		// Delete existing playlists associated with WeatherRecommendation
		if (existingWeatherRecommendation) {
			for (let i = 1; i <= 5; i++) {
				const playlistField = `playlist${i}`;
				const playlistId = existingWeatherRecommendation[playlistField];
				await Playlist.findByIdAndDelete(playlistId);
			}
		}
		
		console.log(existingWeatherRecommendation)
		
		// If there is no existingWeatherRecommendation, create a new one
		if (existingWeatherRecommendation === null) {
			// console.log("hello")
			existingWeatherRecommendation = new WeatherRecommendation({ user: req.user._id });
		}

		// Create and save new playlists with the updated recommendations
		const playlists = [];
		if (filteredRecommendations.length >= 50) {
			// Split 10 songs in each of the 5 playlists
			for (let i = 0; i < 5; i++) {
				const playlistName = `RecommendedPlaylist${i + 1}`;
				const playlistThumbnail = "https://images.unsplash.com/photo-1593958812614-2db6a598c71c?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8ZGlzY298ZW58MHx8MHx8fDA%3D";

				const playlistData = {
					name: playlistName,
					thumbnail: playlistThumbnail,
					owner: req.user._id,
					collaborators: [],
				};

				// Create a new playlist
				const playlist = await Playlist.create(playlistData);

				// Add 10 songs to the playlist
				for (let j = 0; j < 10; j++) {
					const songIndex = i * 10 + j;
					playlist.songs.push(filteredRecommendations[songIndex % filteredRecommendations.length]);
				}

				// Save the playlist
				await playlist.save();

				// Update WeatherRecommendation with the created playlist
				const playlistField = `playlist${i + 1}`;
				existingWeatherRecommendation[playlistField] = playlist._id;
				playlists.push(playlist);
			}
		} else {
			// Less than 50 recommendations, each playlist can have repetitions
			for (let i = 0; i < 5; i++) {
				const playlistName = `RecommendedPlaylist${i + 1}`;
				const playlistThumbnail = "https://images.unsplash.com/photo-1593958812614-2db6a598c71c?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8ZGlzY298ZW58MHx8MHx8fDA%3D";

				const playlistData = {
					name: playlistName,
					thumbnail: playlistThumbnail,
					owner: req.user._id,
					collaborators: [],
				};

				// Create a new playlist
				const playlist = await Playlist.create(playlistData);

				// Add all recommendations to the playlist
				for (let j = 0; j < filteredRecommendations.length; j++) {
					playlist.songs.push(filteredRecommendations[j]);
				}

				// Save the playlist
				await playlist.save();

				// Update WeatherRecommendation with the created playlist
				const playlistField = `playlist${i + 1}`;
				existingWeatherRecommendation[playlistField] = playlist._id;
				playlists.push(playlist);
			}
		}

		// Save updated WeatherRecommendation
		await existingWeatherRecommendation.save();

		return res.status(201).json({ data: playlists });
	} catch (error) {
		console.error(error);
		return res.status(500).json({ error: "Internal Server Error" });
	}
});

// Wrap the asynchronous code in a Promise
const executePythonScript = (likedSongs) => {
	return new Promise((resolve, reject) => {
		const pythonProcess = spawn("python3", ["/home/nihal/Desktop/edoc/proj/Euphony/euphony_backend/utils/LikedSongSuggestScript.py", JSON.stringify(likedSongs)]);
		let dataBuffer = "";

		pythonProcess.stdout.on("data", (data) => {
			dataBuffer += data.toString();
		});

		pythonProcess.stderr.on("data", (data) => {
			console.error(`Python script error: ${data}`);
		});

		pythonProcess.on("close", (code) => {
			if (code === 0) {
				const recommendations = JSON.parse(dataBuffer);
				// console.log("Python script returned:", recommendations);
				resolve(recommendations);
			} else {
				console.error(`Python script process exited with code ${code}`);
				reject(new Error("Python script execution failed"));
			}
		});
	});
};

// Execute Python script function
const executePythonScript2 = async (text) => {
	return new Promise((resolve, reject) => {
		const pythonProcess = spawn("python3", ["/home/nihal/Desktop/edoc/proj/Euphony/euphony_backend/utils/TextToEmotionScript.py", text]);
		let dataBuffer = "";

		pythonProcess.stdout.on("data", (data) => {
			dataBuffer += data.toString();
		});

		pythonProcess.stderr.on("data", (data) => {
			console.error(`Python script error: ${data}`);
		});

		pythonProcess.on("close", (code) => {
			if (code === 0) {
				const recommendations = JSON.parse(dataBuffer);
				resolve(recommendations);
			} else {
				console.error(`Python script process exited with code ${code}`);
				reject(new Error("Python script execution failed"));
			}
		});
	});
};

const executePythonScript3 = async () => {
	return new Promise((resolve, reject) => {
		const pythonProcess = spawn("python3", ["/home/nihal/Desktop/edoc/proj/Euphony/euphony_backend/utils/WeatherToSongSuggestScript.py"]);
		let dataBuffer = "";

		pythonProcess.stdout.on("data", (data) => {
			dataBuffer += data.toString();
		});

		pythonProcess.stderr.on("data", (data) => {
			console.error(`Python script error: ${data}`);
		});

		pythonProcess.on("close", (code) => {
			if (code === 0) {
				const recommendations = JSON.parse(dataBuffer);
				resolve(recommendations);
			} else {
				console.error(`Python script process exited with code ${code}`);
				reject(new Error("Python script execution failed"));
			}
		});
	});
};

module.exports = router;
