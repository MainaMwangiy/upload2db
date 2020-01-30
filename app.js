const express = require("express");
const bodyParser = require("body-parser");
const multer = require("multer");
const ejs = require("ejs");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
const GridFsStorage = require("multer-gridfs-storage");
const Grid = require("gridfs-stream");
const methodOverride = require("method-override");

Grid.mongo = mongoose.mongo;

mongoose.set("useNewUrlParser", true);
mongoose.set("useFindAndModify", true);
mongoose.set("useCreateIndex", true);

const app = express();

//add middlewares
app.use(bodyParser.json());
app.use(methodOverride("_method"));
app.set("view engine", "ejs");

app.use(express.static("./public"));

//INIT gfs
let gfs;

//Mongodb URL
mongoose.Promise = global.Promise;

mongoose.connect("mongodb://localhost:27017/keja", { useNewUrlParser: true });
var conn = mongoose.connection;

conn.once("open", () => {
  console.log("MongoDB Connected");
  //then initailize our stream
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection("uploads");
});

conn.on("error", function(err) {
  console.log(err);
});

//create our storage engine
const storage = new GridFsStorage({
  url: "mongodb://localhost:27017/keja",
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        const filename = buf.toString("hex") + path.extname(file.originalname);
        const fileInfo = {
          filename: filename,
          bucketName: "uploads"
        };
        resolve(fileInfo);
      });
    });
  }
});

const upload = multer({ storage });

//@routes GET /
//loads form
app.get("/", (req, res) => {
  gfs.files.find().toArray((err, files) => {
    //check if files
    if (!files || files.length === 0) {
      res.render("index", { files: false });
    } else {
      files.map(file => {
        if (
          file.contentType === "image/jpeg" ||
          file.contentType === "image/png"
        ) {
          file.isImage = true;
        } else {
          file.isImage = false;
        }
      });
      res.render("index", { files: files });
    }
  });
});

//@routes POST /upload
// Uploads file into DB
app.post("/upload", upload.single("file"), (req, res) => {
  res.redirect("/");
});

// @route GET /
// desc Display all files in json
app.get("/files", (req, res) => {
  gfs.files.find().toArray((err, files) => {
    //check if files
    if (!files || files.length === 0) {
      return res.status(404).json({
        err: "No files Exist"
      });
    }

    //files exist
    return res.json(files);
  });
});

//@route GET /files/ :filename
//desc Display all files in json
app.get("/files/:filename", (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    //check if files
    if (!files || files.length === 0) {
      return res.status(404).json({
        err: "No files Exist"
      });
    }
    //check if image
    if (file.contentType === "image/jpeg" || file.contentType === "image/png") {
      //read output to browser
      const readstream = gfs.createReadStream(file.filename);
      readstream.pipe(res);
    } else {
      res.status(404).json({
        err: "Not an Image"
      });
    }
  });
});

// @route GET /image/:filename
// @desc image single file object
app.get("/image/:filename", (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    // Check if file
    if (!file || file.length === 0) {
      return res.status(404).json({
        err: "No file exists"
      });
    }
    // File exists
    res.set("Content-Type", file.contentType);
    res.set(
      "Content-Disposition",
      'attachment; filename="' + file.filename + '"'
    );
    // streaming from gridfs
    var readstream = gfs.createReadStream({
      filename: req.params.filename
    });
    //error handling, e.g. file does not exist
    readstream.on("error", function(err) {
      console.log("An error occurred!", err);
      throw err;
    });
    readstream.pipe(res);
  });
});

// @route GET /download/:filename
// @desc  Download single file object
app.get("/download/:filename", (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    // Check if file
    if (!file || file.length === 0) {
      return res.status(404).json({
        err: "No file exists"
      });
    }
    // File exists
    res.set("Content-Type", file.contentType);
    res.set(
      "Content-Disposition",
      'attachment; filename="' + file.filename + '"'
    );
    // streaming from gridfs
    var readstream = gfs.createReadStream({
      filename: req.params.filename
    });
    //error handling, e.g. file does not exist
    readstream.on("error", function(err) {
      console.log("An error occurred!", err);
      throw err;
    });
    readstream.pipe(res);
  });
});

//@route DELETE /files/ :id
//desc Delete file
app.delete("/files/:id", (req, res) => {
  gfs.remove({ _id: req.params.id, root: "uploads" }, (err, gridStore) => {
    if (err) {
      return res.status(404).json({ err: err });
    }

    res.redirect("/");
  });
});

const port = 4222;

app.listen(port, () => console.log("App Running on port: " + port));
