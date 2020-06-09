const express = require("express");
const util = require("util");
const exec = util.promisify(require("child_process").exec);
const fs = require("fs");
const mime = require("mime");
const {Storage} = require('@google-cloud/storage')
var cors = require('cors')

const projectId = "bitprint-store";
const bucketName = `${projectId}.appspot.com`;

const storage = new Storage({
  projectId
});

const bucket = storage.bucket(bucketName);

const PORT = process.env.PORT;
const HOST = "0.0.0.0";

const app = express();

app.use(express.urlencoded({ extended: true }));

var corsOptions = {
  origin: ['http://bitprint.io', 'https://bitprint.io', 'http://api.bitprint.io', 'https://api.bitprint.io'],
  optionsSuccessStatus: 200
}
app.use(cors(corsOptions))

var error = false;

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

  var url = await uploadFile(`./png/${filename}.png`, `png/${filename}.png`).catch((err) => {
    res.status(500);
    res.send(err);
    error = true;
    return;
  });

  console.log(`Deleting ${filename}`);

  fs.unlink(`${__dirname}/scad/${filename}.scad`, (err) => {
    if (err) {
      res.status(500);
      res.send(err);
      return;
    }
  });

  fs.unlink(`${__dirname}/png/${filename}.png`, (err) => {
    if (err) {
      res.status(500);
      res.send(err);
      return;
    }
  });

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

  var url = await uploadFile(`./stl/${filename}.stl`, `stl/${filename}.stl`).catch((err) => {
    res.status(500);
    res.send(err);
    return;
  });

  console.log(`Deleting ${filename}`);

  fs.unlink(`${__dirname}/scad/${filename}.scad`, (err) => {
    if (err) {
      res.status(500);
      res.send(err);
      return;
    }
  });

  fs.unlink(`${__dirname}/stl/${filename}.stl`, (err) => {
    if (err) {
      res.status(500);
      res.send(err);
      return;
    }
  });

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
  return `https://storage.googleapis.com/${bucketName}/${encodeURIComponent(
    storageName
  )}`;
}

app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);
