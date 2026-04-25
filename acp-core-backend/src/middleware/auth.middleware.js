const { CognitoJwtVerifier } = require('aws-jwt-verify');

const verifier = CognitoJwtVerifier.create({
    userPoolId: process.env.COGNITO_USER_POOL_ID,
    tokenUse: 'access',
    clientId: process.env.COGNITO_CLIENT_ID,
});

module.exports = async (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        const token = auth.split(' ')[1];

        // Decode JWT payload without verifying signature (dev only)
        const payload = JSON.parse(
            Buffer.from(token.split('.')[1], 'base64').toString('utf8')
        );

        // Basic sanity checks
        if (!payload.sub || !payload.username) {
            return res.status(401).json({ message: 'Invalid token payload' });
        }

        // Check token is not expired
        if (payload.exp && Date.now() / 1000 > payload.exp) {
            return res.status(401).json({ message: 'Token expired' });
        }

        req.user = { username: payload.username };
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};