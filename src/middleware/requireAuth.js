const passport = require("passport");

const requireAuth = () => {
  return (req, res, next) => {
    passport.authenticate(
      "jwt",
      { session: false },
      function (err, user, info) {
        if (err) {
          return next(err);
        }
        if (!user) {
          console.log("user from req", user);
          return res.status(401).json("unauthorized").end();
        }
        // console.log(user.role);
        // console.log(allowedRoles.includes(user.role));

        // if (user.role != role.ADMIN && !allowedRoles.includes(user.role)) {
        //   return res.status(401).json("unauthorized").end();
        // }

        req.currentUser = user;
        next();
      }
    )(req, res, next); // Pass 'next' as the third argument here
  };
};

module.exports = requireAuth;
