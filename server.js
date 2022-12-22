//jshint esversion: 6
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth2").Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();

app.set("trust proxy", 1);

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "https://gpa-tracker.up.railway.app/");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET , POST , DELETE , PUT , OPTIONS");
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Set-Cookie",["Path=/;HttpOnly; maxAge=86400000;SameSite=None;Secure=true;"]);
  next();
});

app.use(express.urlencoded({
  extended: true
}));


app.use(session({
  secret: process.env.SECRET,
  resave: true,
  saveUninitialized: false,
  cookie:{
    sameSite: "none",
    secure: true
  }
}));


app.use(passport.initialize());
app.use(passport.session());

password = process.env.PASSWORD;

mongoose.connect("mongodb+srv://admin-jonas:"+password+"@cluster0.uajgt.mongodb.net/user2DB", {
  useUnifiedTopology: true,
  useNewUrlParser: true
});

mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  name: String,
  semesters: String,
  GPA: Array,
  googleId: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

var User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});


function createArray(x, y, z) {
  for (let i = 1; i <= y; i++) {
    x.push(z + i);
  }
}

function toNumber(a) {
  numbers = a.map((x) => {
    return parseFloat(x, 10);
  });
}


passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "https://gpa-tracker-backend.up.railway.app/auth/google/gpatracker",
  passReqToCallback: true,
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},
function(request, accessToken, refreshToken, profile, done) {
  User.findOrCreate({ googleId: profile.id, username: profile.emails[0].value },{semesters:0}, {saveIfFound: false}, function (err, user) {
    return done(err, user);
  });
}
));


app.get("/", function(req,res){
  res.send("GPA Tracker API");
});



app.post("/register", function(req, res) {
  User.register({
    username: req.body.username
  }, req.body.password, function(err, user) {
    if (err) {
      console.log(err);
      res.redirect("https://gpa-tracker.up.railway.app/register");
    } else {
      user.name = req.body.name;
      user.semesters = 0;
      user.save();
      passport.authenticate("local")(req, res, function() {
        res.redirect("https://gpa-tracker.up.railway.app/profile");
      });
    }
  });
});

app.post("/login", function(req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });
  req.login(user, function(err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("https://gpa-tracker.up.railway.app//dashboard");
      });
    }
  });
});

app.get("/auth/google",
  passport.authenticate("google", { scope:
      ["profile","email" ] }
));

app.get( "/auth/google/gpatracker",
    passport.authenticate( "google", {
        successRedirect: "https://gpa-tracker.up.railway.app/profile",
        failureRedirect: "https://gpa-tracker.up.railway.app/login"
}));

app.post("/profile", function(req, res) {
  if (req.isAuthenticated()) {
    semesterCreditList = [];
    semesterGradeList = [];
    Gpa = [];
    semesters = req.body.semesters;
    createArray(semesterGradeList, semesters, "semesterGrade");
    createArray(semesterCreditList, semesters, "semesterCredit");
    for (let i = 0; i < semesters; i++) {

      totalGrade = 0;
      semesterGrade = req.body[semesterGradeList[i]];
      toNumber(semesterGrade);
      semesterGrade = numbers;

      semesterCredit = req.body[semesterCreditList[i]];
      toNumber(semesterCredit);
      semesterCredit = numbers;

      totalCredit = semesterCredit.reduce((a, b) => a + b, 0);
      for (let j = 0; j < 10; j++) {
        totalGrade += semesterGrade[j] * semesterCredit[j];
      }

      Gpa.push(totalGrade / totalCredit);

    }
    User.findById(req.user.id, function(err, result) {
      if (err) {
        console.log(err);
      } else {
        result.semesters = parseInt(semesters);
        result.GPA = Gpa;
        result.save();
        res.redirect("hhttps://gpa-tracker.up.railway.app/dashboard");
      }
    });
  }
});


app.post("/profile2", function(req, res) {
  if (req.isAuthenticated()) {
    User.findById(req.user.id, function(err, result) {
      if (err) {
        console.log(err);
      } else {
        totalGrade = 0;
        totalCredit = 0;
        GPA = result.GPA;
        semesters = (parseInt(result.semesters)) + 1;

        semesterGrade = req.body.semesterGrade;
        toNumber(semesterGrade);
        semesterGrade = numbers;

        semesterCredit = req.body.semesterCredit;
        toNumber(semesterCredit);
        semesterCredit = numbers;

        totalCredit = semesterCredit.reduce((x, y) => x + y, 0);

        for (let j = 0; j < 10; j++) {
          totalGrade += semesterGrade[j] * semesterCredit[j];
        }

        Gpa = totalGrade / totalCredit;
        GPA.push(Gpa);
        result.GPA = GPA;
        result.semesters = semesters;
        result.save();
        res.redirect("https://gpa-tracker.up.railway.app/dashboard");
      }
    });
  }
});

app.post("/reset", function(req,res){
  if (req.isAuthenticated()){
    User.findById(req.user.id, function(err, result) {
      if (err) {
        console.log(err);
      } else {
        result.GPA = [];
        result.semesters=0;
        result.save();
        res.redirect("https://gpa-tracker.up.railway.app/dashboard");
      }
    });
  }
});


app.get("/api/auth", function(req, res) {
  if (req.isAuthenticated()) {
    res.json({
      "message": true
    });
  } else {
    res.json({
      "message": false
    });
  }
});

app.get("/api/label", function(req, res) {
  if (req.isAuthenticated()) {
    User.findById(req.user.id, function(err, result) {
      if (err) {
        console.log(err);
      } else {
        label = [];
        semesters = result.semesters;
        Gpa = result.GPA;
        createArray(label, semesters, "Semester ");
        res.json({
          "Label": label
        });
      }
    });
  }
});

app.get("/api/gpa", function(req, res) {
  if (req.isAuthenticated()) {
    User.findById(req.user.id, function(err, result) {
      if (err) {
        console.log(err);
      } else {
        Gpa = result.GPA;
        res.json({
          "GPA": Gpa
        });
      }
    });
  }
});

app.get("/api/profile", function(req, res) {
  if (req.isAuthenticated()) {
    User.findById(req.user.id, function(err, result) {
      if (err) {
        console.log(err);
      } else {
        userSemester = result.semesters;
        GPA = result.GPA;
        res.json({
          "userSemester": userSemester
        });
      }
    });
  }else{
    res.json({
      "userSemester": 0
    });
  }
});

app.post("/logout", function(req, res) {
  req.logout();
  res.redirect("https://gpa-tracker.up.railway.app/");
});

app.listen(process.env.PORT || 5000, function() {
  console.log("hello there.");
});
