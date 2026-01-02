const { spawn } = require("child_process");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..", "..", "..");
const serverDir = path.join(projectRoot, "server");

const runScript = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: serverDir,
      env: { ...process.env, ...options.env },
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() });
    });
    child.on("error", (error) => {
      reject(error);
    });
  });

const runNodeScript = async (scriptPath, args = []) => {
  const absolute = path.join(serverDir, scriptPath);
  return runScript("node", [absolute, ...args]);
};

const runIngest = async (filePath, options = {}) => {
  const args = [filePath];
  if (options.organizationName) {
    args.push("--org-name", options.organizationName);
  }
  if (options.organizationCode) {
    args.push("--org-code", options.organizationCode);
  }
  if (options.monthKey) {
    args.push("--month-key", options.monthKey);
  }
  if (options.monthLabel) {
    args.push("--month-label", options.monthLabel);
  }
  return runNodeScript("src/ingest.js", args);
};

module.exports = {
  runNodeScript,
  runIngest,
  serverDir,
};
