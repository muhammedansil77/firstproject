import winston from "winston";
import fs from "fs";
import path from "path";

const logDir = "logs";

// create logs folder if not exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf(
      (info) => `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}`
    )
  ),
  transports: [
    new winston.transports.File({ filename: `${logDir}/error.log`, level: "error" }),
    new winston.transports.File({ filename: `${logDir}/combined.log` }),
    new winston.transports.Console()
  ]
});

export default logger;
