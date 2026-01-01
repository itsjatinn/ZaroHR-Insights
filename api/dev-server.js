require("dotenv").config();
const http = require("http");

const handler = require("./[...path].js");

const port = Number(process.env.API_PORT || "8000");

const server = http.createServer((req, res) => {
  if (!req.url.startsWith("/api")) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain");
    res.end("Not found.");
    return;
  }
  handler(req, res);
});

server.listen(port, () => {
  console.log(`Local API running at http://localhost:${port}/api`);
});
