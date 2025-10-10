const jwt = require('jsonwebtoken')

const verifyJWT = (req, res, next) => {
    const authHeader = req.headers.authorization || req.headers.Authorization

    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized' })
    }

    const token = authHeader.split(' ')[1]

    jwt.verify(
        token,
        process.env.ACCESS_TOKEN_SECRET,
        (err, decoded) => {
            if (err) return res.status(403).json({ message: 'Forbidden' })
            // decoded.UserInfo contains the claims we set when issuing the token.
            // Normalize req.user as an object so callers can read req.user.id
            const ui = decoded.UserInfo || {};
            req.user = {
                id: ui.userId || ui.id || null,
                username: ui.username || null,
                roles: ui.roles || [],
                verified: ui.verified || false,
            };
            next()
        }
    )
}

module.exports = verifyJWT 