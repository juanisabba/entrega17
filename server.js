const express = require("express");
const session = require("express-session");
const { Server : HttpServer } = require("http");
const flash = require("connect-flash");
const passport = require("passport");
const { Strategy: LocalStrategy } = require("passport-local");
const { logger200, logger404 } = require("./middlewares.js");
const { logger, loggerError } = require("./logger.js");
const { connect } = require("mongoose");
const User = require("./models/User");
const { createHash, isValidPassword } = require("./utlis");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const os = require('os');
const cluster = require('cluster');
const numCpus = os.cpus().length
const minimist = require("minimist");
const randomRouter = require("./routers/randomRouter.js");

const app = express();
const httpServer = new HttpServer(app);

const options = {
  alias: {
    p: "PORT",
    m: "MODO",
  },
};

const myArgs = minimist(process.argv.slice(2), options);

connect(process.env.MONGODB)
  .then((_) => console.log("db connected"))
  .catch((e) => console.log(e));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(flash());
app.use(cookieParser());

app.use(
  session({
    secret: "qwerty",
    cookie: { maxAge: 600000 },
    resave: true,
    saveUninitialized: true,
  })
);

app.use(passport.initialize());
app.use(passport.session());
app.set("view engine", "ejs");

app.use('/api/random',  logger200(), randomRouter);

passport.use(
  "login",
  new LocalStrategy((username, password, done) => {
    return User.findOne({ username })
      .then((user) => {
        if (!user) {
          return done(null, false, { message: "usuario inexistente" });
        }

        if (!isValidPassword) {
          return done(null, false, { message: "contraseña incorrecta" });
        }
        return done(null, user);
      })
      .catch((err) => done(err));
  })
);

passport.use(
  "signup",
  new LocalStrategy(
    {
      passReqToCallback: true,
    },
    (req, username, password, done) => {
      User.findOne({ username })
        .then((user) => {
          if (user) {
            return done(null, false, { message: "El username ya existe" });
          }

          const newUser = new User();
          newUser.username = username;
          newUser.password = createHash(password);
          newUser.email = req.body.email;

          return newUser.save();
        })
        .then((user) => done(null, user))
        .catch((err) => done(err));
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser((id, done) => {
  User.findById(id, (err, user) => {
    done(err, user);
  });
});

app.get(
  "/",
  (req, res, next) => {
    if (req.isAuthenticated()) {
      return next();
    }

    return res.redirect("/login");
  },
  (req, res) => {
    return res.render("home", {
      username: req.user.username,
      email: req.user.email,
    });
  }
);

app.get("/login", (req, res) => {
  return res.render("login", { message: req.flash("error") });
});

app.get("/signup", (req, res) => {
  return res.render("signup", { message: req.flash("error") });
});

app.post(
  "/login",
  passport.authenticate("login", {
    successRedirect: "/",
    failureRedirect: "/login",
    failureFlash: true,
  })
);

app.post(
  "/signup",
  passport.authenticate("signup", {
    successRedirect: "/login",
    failureRedirect: "/signup",
    failureFlash: true,
  })
);

app.post("/logout", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/login");
  }

  return req.session.destroy((err) => {
    if (!err) {
      return res.redirect("/login");
    }
    return res.send("error");
  });
});

app.get("/info", (req, res) => {
  let name = process.platform;
  let version = process.version;
  let rss = JSON.stringify(process.memoryUsage());
  let path = process.execPath;
  let pid = process.pid;
  let folder = process.cwd();
  return res.json({
    name,
    version,
    rss,
    path,
    pid,
    folder,
  });
});
  
const PORT = process.env.PORT || 8081;

if (myArgs.MODO === "cluster") {
  if (cluster.isPrimary) {
    console.log(`El master con pid numero ${process.pid} esta funcionando`);

    for (let i = 0; i < numCpus; i++) {
      cluster.fork();
    }

    cluster.on("exit", (worker, code, signal) => {
      console.log(`el worker ${worker.process.pid} murió`);
    });
  } else {
    const server = httpServer.listen(PORT, () => {
      console.log(
        `Servidor http escuchando en el puerto ${server.address().port}`
      );
    });
    server.on("error", (error) => console.log(`Error en servidor ${error}`));
  }
} else if (myArgs.MODO === "fork" || !myArgs.MODO) {
  app.listen(PORT, ()=> {
    console.log('running on port', PORT)
  })
  //   const server = httpServer.listen(PORT, () => {
  //       console.log(`Servidor http escuchando en el puerto ${server.address().port}`)
  //   })
  //   server.on("error", error => console.log(`Error en servidor ${error}`));
  // }
}