const express = require("express");
const mongoose = require("mongoose");
const JwtStrategy = require("passport-jwt").Strategy,
	ExtractJwt = require("passport-jwt").ExtractJwt;
const passport = require("passport");
const User = require("./models/User");
const authRoutes = require("./routes/authRoute");
const songRoutes = require("./routes/songRoute");
const playlistRoutes = require("./routes/playlistRoute");
require("dotenv").config();
const cors = require("cors");
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// connect mongodb to node app
mongoose
	.connect("mongodb+srv://AkibNihal:" + process.env.MONGO_PASSWORD + "@cluster0.1k1go3e.mongodb.net/?retryWrites=true&w=majority", {
		useNewUrlParser: true,
		useUnifiedTopology: true,
	})
	.then((x) => {
		console.log("Connected to Mongo!");
	})
	.catch((err) => {
		console.log("Error while connecting to Mongo!");
	});

//   setup passport-jwt for authentication

let opts = {};
opts.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
opts.secretOrKey = "thisKeyIsSupposedToBeSecret";
passport.use(
	new JwtStrategy(opts, function (jwt_payload, done) {
		User.findOne({ _id: jwt_payload.identifier }, function (err, user) {
			// done(error, doesTheUserExist)
			if (err) {
				return done(err, false);
			}
			if (user) {
				return done(null, user);
			} else {
				return done(null, false);
				// or you could create a new account
			}
		});
	})
);
app.get("/", (req, res) => {
	res.send("hello world");
});

app.use("/auth", authRoutes);
app.use("/song", songRoutes);
app.use("/playlist", playlistRoutes);

app.listen(port, () => {
	console.log("App is running on port " + port);
});
