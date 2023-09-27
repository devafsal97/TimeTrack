const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/user");

exports.configureGoogleStrategy = () => {
  passport.use(
    new GoogleStrategy(
      {
        clientID:
          "959461062208-qkkmlkv46mm63ba8uo51nvcpflemt6bm.apps.googleusercontent.com",
        clientSecret: "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",
        callbackURL: "https://timetrack.au-ki.com/api/google/callback",
        passReqToCallback: true,
      },
      async function (request, accessToken, refreshToken, profile, done) {
        try {
          const user = await User.findUserByEmail(profile._json.email);
          console.log("user", user, profile);
          if (user) {
            return done(null, user);
          }
        } catch (err) {
          console.log(err);
        }
      }
    )
  );
};
