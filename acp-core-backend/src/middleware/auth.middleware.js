const { CognitoJwtVerifier } = require('aws-jwt-verify');

let verifier = null;

const isMockMode = () => {
    return process.env.COGNITO_USER_POOL_ID === 'us-east-1_abcdefghi' || process.env.MOCK_AUTH === 'true';
};

const getVerifier = () => {
    if (verifier) return verifier;

    const { COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID } = process.env;
    if (!COGNITO_USER_POOL_ID || !COGNITO_CLIENT_ID) {
        throw new Error('Cognito auth is not configured. Set COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID, or set MOCK_AUTH=true for local development.');
    }

    verifier = CognitoJwtVerifier.create({
        userPoolId: COGNITO_USER_POOL_ID,
        tokenUse: 'access',
        clientId: COGNITO_CLIENT_ID,
    });

    return verifier;
};

module.exports = async (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        const token = auth.split(' ')[1];
        let payload;

        if (isMockMode()) {
            payload = JSON.parse(
                Buffer.from(token.split('.')[1], 'base64').toString('utf8')
            );
        } else {
            payload = await getVerifier().verify(token);
        }

        // Cognito access tokens use 'cognito:username'; ID tokens use 'username'
        const username = payload.username || payload['cognito:username'] || payload.sub;

        // Basic sanity checks
        if (!payload.sub || !username) {
            return res.status(401).json({ message: 'Invalid token payload' });
        }

        // Check token is not expired
        if (payload.exp && Date.now() / 1000 > payload.exp) {
            return res.status(401).json({ message: 'Token expired' });
        }

        req.user = { username };
        next();
    } catch (err) {
        if (err.message && err.message.startsWith('Cognito auth is not configured')) {
            console.error(err.message);
            return res.status(500).json({ message: err.message });
        }
        return res.status(401).json({ message: 'Invalid token' });
    }
};
