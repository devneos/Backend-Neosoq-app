require("dotenv").config();
require("express-async-errors");
const express = require("express");
const app = express();
const path = require("path");
const { logger, logEvents } = require("./middleware/logger");
const errorHandler = require("./middleware/errorHandler");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const cors = require("cors");
const corsOptions = require("./config/corsOptions");
const connectDB = require("./config/dbConn");
const mongoose = require("mongoose");
const PORT = process.env.PORT || 3500;

// Only connect to MongoDB and start listening when running server directly.
if (require.main === module) {
  // Connect to MongoDB and start the app
  connectDB();

  mongoose.connection.once("open", () => {
      console.log("Connected to MongoDB");
      // Start the server after the DB connection is open
      app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  });

  mongoose.connection.on("error", (err) => {
      console.log(err);
      logEvents(
          `${err.no}: ${err.code}\t${err.syscall}\t${err.hostname}`,
          "mongoErrLog.log"
      );
  });
}

// Middleware
app.use(logger);
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.json({ limit: "50kb" })); // Increase if necessary
app.use(bodyParser.json({ limit: "600mb" }));
app.use(bodyParser.urlencoded({ limit: "600mb", extended: true }));
app.use(bodyParser.text({ limit: "600mb" }));
app.use(cookieParser());

// Routes
app.use("/auth", require("./routes/authRoutes"));
app.use("/listings", require("./routes/listingsRoutes"));
app.use("/offers", require("./routes/offersRoutes"));
app.use("/requests", require("./routes/requestsRoutes"));
app.use("/reviews", require("./routes/reviewsRoutes"));
app.use("/disputes", require("./routes/disputesRoutes"));

// 404 Handler
app.all("*", (req, res) => {
    res.status(404).json({ message: "404 Not Found" });
});

// Error Handler
app.use(errorHandler);

module.exports = app;