const express = require("express");
const util = require("util");
const exec = util.promisify(require("child_process").exec);
const fs = require("fs");
const mime = require("mime");
const cors = require('cors');
const {Storage} = require('@google-cloud/storage')

const keyFilename = "./bitprint-9d203-firebase-adminsdk.json";
const projectId = "bitprint-9d203";
const bucketName = `${projectId}.appspot.com`;

const storage = new Storage({
  projectId,
  keyFilename,
});

const bucket = storage.bucket(bucketName);

const PORT = 8080;
const HOST = "0.0.0.0";

const app = express();

app.use(cors());

app.use(express.urlencoded({ extended: true }));

var error = false;
var previousPNGFiles = new Array();
var previousSTLFiles = new Array();

app.post("/api/png", async (req, res) => {
  var colorscheme = req.body.colorscheme;
  var size = req.body.size;
  var code = req.body.code;
  var filename = req.body.filename;
  if (
    code == null ||
    size == null ||
    colorscheme == null ||
    code == "" ||
    size == "" ||
    colorscheme == ""
  ) {
    res.status(406);
    res.send("Failed to pass something");
    error = true;
    return;
  }

  if (filename == "" || filename == null) {
    filename =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
  }

  fs.writeFileSync(`${__dirname}/scad/${filename}.scad`, code);

  try {
    await exec(
      `xvfb-run -a openscad -o ./png/${filename}.png --colorscheme=${colorscheme} --imgsize ${size} ./scad/${filename}.scad`
    );
  } catch (err) {
    res.status(500);
    res.send(err.stderr);
    error = true;
    return;
  }

  previousPNGFiles.push(filename);

  var url = await uploadFile(`./png/${filename}.png`, `png/${filename}.png`).catch((err) => {
    res.status(500);
    res.send(err);
    error = true;
    return;
  });

  //delete old files
  if (previousPNGFiles.length >= 3) {
    previousPNGFiles.forEach((file) => {
      if (file != filename) {
        console.log(`Deleting ${file}`);
        fs.unlink(`${__dirname}/scad/${file}.scad`, (err) => {
          if (err) {
            console.error(err);
            res.status(500);
            res.send(err);
            error = true;
            return;
          }
        });
        fs.unlink(`${__dirname}/png/${file}.png`, (err) => {
          if (err) {
            console.error(err);
            res.status(500);
            res.send(err);
            error = true;
            return;
          }
        });
        previousPNGFiles.splice(file, 1);
      } else {
        console.log(`Skipping current files: ${filename}`);
      }
    });
  }

  if (!error) {
    res.status(200);
    res.json({url: url, id: filename});
  }
});

app.post("/api/stl", async (req, res) => {
  var code = req.body.code;
  var filename = req.body.filename;
  if (
    code == null ||
    code == ""
  ) {
    res.status(406);
    res.send("Failed to pass something");
    return;
  }

  if (filename == "" || filename == null) {
    filename =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
  }

  fs.writeFileSync(`${__dirname}/scad/${filename}.scad`, code);

  try {
    await exec(
      `xvfb-run -a openscad -o ./stl/${filename}.stl ./scad/${filename}.scad`
    );
  } catch (err) {
    res.status(500);
    res.send(err.stderr);
    return;
  }

  previousSTLFiles.push(filename);

  var url = await uploadFile(`./stl/${filename}.stl`, `stl/${filename}.stl`).catch((err) => {
    res.status(500);
    res.send(err);
    return;
  });

  //delete old files
  if (previousSTLFiles.length >= 3) {
    previousSTLFiles.forEach((file) => {
      if (file != filename) {
        console.log(`Deleting ${file}`);
        fs.unlink(`${__dirname}/scad/${file}.scad`, (err) => {
          if (err) {
            console.error(err);
            res.status(500);
            res.send(err);
            return;
          }
        });
        fs.unlink(`${__dirname}/stl/${file}.stl`, (err) => {
          if (err) {
            console.error(err);
            res.status(500);
            res.send(err);
            return;
          }
        });
        previousSTLFiles.splice(file, 1);
      } else {
        console.log(`Skipping current files: ${filename}`);
      }
    });
  }

  res.status(200);
  res.json({url: url, id: filename});
});

const uploadFile = (filePath, uploadTo) => {
  const fileMime = mime.getType(filePath);

  return new Promise((resolve, reject) => {
    bucket.upload(
      filePath,
      {
        destination: uploadTo,
        public: true,
        metadata: {
          contentType: fileMime,
          cacheControl: "public, max-age=300",
        },
      },
      function (err, file) {
        if (err) {
          reject(err);
        } else {
          resolve(createPublicFileURL(uploadTo));
        }
      }
    );
  });
};

function createPublicFileURL(storageName) {
  return `http://storage.googleapis.com/${bucketName}/${encodeURIComponent(
    storageName
  )}`;
}

app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);
