const express = require("express");
const multer = require("multer");
const FormData = require("form-data");
const app = express();
const upload = multer();
app.post("/upload", upload.single("file"), (req, res) => {
  res.json({ body: req.body });
});
const server = app.listen(3000, async () => {
  const form = new FormData();
  form.append("file", Buffer.from("test"), { filename: "test.jpg", contentType: "image/jpeg" });
  form.append("doc_type", "test");
  form.append("enrollment_id", "123");
  const fetch = require("node-fetch");
  const res = await fetch("http://localhost:3000/upload", { method: "POST", body: form });
  const data = await res.json();
  console.log(data);
  server.close();
});
