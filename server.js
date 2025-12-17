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
                        const http = require('http');
                        const server = http.createServer(app);

                        // Try to attach Socket.IO if available, but don't crash if it's missing
                        try {
                            // require may throw if socket.io is not installed in this environment
                            const { Server } = require('socket.io');
                            const io = new Server(server, { cors: { origin: '*' } });

                            // Attach io instance to app so controllers can emit events
                            app.set('io', io);

                            io.on('connection', (socket) => {
                                socket.on('join', (conversationId) => {
                                    socket.join(String(conversationId));
                                });
                                socket.on('leave', (conversationId) => {
                                    socket.leave(String(conversationId));
                                });
                                socket.on('send_message', async (payload) => {
                                    // payload: { conversationId, sender, body, attachments }
                                    try {
                                        const ChatMessage = require('./models/ChatMessage');
                                        const msg = await ChatMessage.create({ conversationId: payload.conversationId, sender: payload.sender, body: payload.body, attachments: payload.attachments || [] });
                                        io.to(String(payload.conversationId)).emit('message', msg);
                                    } catch (e) {
                                        console.error('socket send_message error', e);
                                    }
                                });
                            });
                        } catch (socketErr) {
                            console.warn('Socket.IO not available — realtime features disabled.', socketErr && socketErr.code === 'MODULE_NOT_FOUND' ? '' : socketErr);
                        }

                        server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
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
app.use("/uploads", require("./routes/uploadsRoutes"));
app.use('/posts', require('./routes/postsRoutes'));
app.use('/feed', require('./routes/feedRoutes'));
app.use('/wallet', require('./routes/walletRoutes'));
app.use('/escrow', require('./routes/escrowRoutes'));
app.use('/promotions', require('./routes/promotionsRoutes'));
app.use('/chat', require('./routes/chatRoutes'));
app.use('/follow', require('./routes/followRoutes'));
app.use('/notifications', require('./routes/notificationsRoutes'));
app.use('/saved', require('./routes/savedRoutes'));
app.use('/account', require('./routes/accountRoutes'));
app.use('/profile', require('./routes/profileRoutes'));
app.use('/contracts', require('./routes/contractsRoutes'));
// Admin routes (staff invites)
app.use('/admin', require('./routes/adminRoutes'));
// Admin authentication (signin for admins/support/moderators)
app.use('/admin/auth', require('./routes/adminAuthRoutes'));
// User content endpoints (listings, offers, posts, requests by user)
app.use('/users', require('./routes/userContentRoutes'));

// 404 Handler
app.all("*", (req, res) => {
    res.status(404).json({ message: "404 Not Found" });
});

// Error Handler
app.use(errorHandler);

module.exports = app;