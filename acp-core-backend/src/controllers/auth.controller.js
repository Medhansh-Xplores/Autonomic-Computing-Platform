const {
    CognitoIdentityProviderClient,
    SignUpCommand,
    ConfirmSignUpCommand,
    InitiateAuthCommand,
    ForgotPasswordCommand,
    ConfirmForgotPasswordCommand,
    ResendConfirmationCodeCommand
} = require('@aws-sdk/client-cognito-identity-provider');

const https = require('https');
const { NodeHttpHandler } = require('@smithy/node-http-handler');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let client = null;

function getCognitoConfig() {
    const { COGNITO_REGION, COGNITO_CLIENT_ID } = process.env;
    if (!COGNITO_REGION || !COGNITO_CLIENT_ID) {
        throw new Error('Cognito auth is not configured. Set COGNITO_REGION and COGNITO_CLIENT_ID, or set MOCK_AUTH=true for local development.');
    }

    return { region: COGNITO_REGION, clientId: COGNITO_CLIENT_ID };
}

function getCognitoClient() {
    if (client) return client;

    const { region } = getCognitoConfig();
    client = new CognitoIdentityProviderClient({
        region,
        requestHandler: new NodeHttpHandler({
            httpsAgent: new https.Agent({ family: 4 })  // force IPv4
        })
    });

    return client;
}

function handleCognitoConfigError(error, res) {
    if (error.message && error.message.startsWith('Cognito auth is not configured')) {
        console.error(error.message);
        res.status(500).json({ message: error.message });
        return true;
    }

    return false;
}

const isMockMode = () => {
    return process.env.COGNITO_USER_POOL_ID === 'us-east-1_abcdefghi' || process.env.MOCK_AUTH === 'true';
};

const mockUsersPath = path.join(__dirname, '../../data/mock-users.json');

function normalizeUsername(username) {
    return String(username || '').trim().toLowerCase();
}

function readMockUsers() {
    if (!fs.existsSync(mockUsersPath)) {
        return {};
    }

    try {
        return JSON.parse(fs.readFileSync(mockUsersPath, 'utf8'));
    } catch {
        return {};
    }
}

function writeMockUsers(users) {
    fs.mkdirSync(path.dirname(mockUsersPath), { recursive: true });
    fs.writeFileSync(mockUsersPath, JSON.stringify(users, null, 2));
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const hash = crypto.pbkdf2Sync(String(password || ''), salt, 100000, 64, 'sha512').toString('hex');
    return { salt, hash };
}

function verifyPassword(password, user) {
    const candidate = hashPassword(password, user.passwordSalt);
    return crypto.timingSafeEqual(
        Buffer.from(candidate.hash, 'hex'),
        Buffer.from(user.passwordHash, 'hex')
    );
}

const generateMockToken = (userName) => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64');
    const payload = Buffer.from(JSON.stringify({
        sub: `mock-uuid-${userName}`,
        username: userName,
        'cognito:username': userName,
        exp: Math.floor(Date.now() / 1000) + 36000
    })).toString('base64');
    return `${header}.${payload}.signature`;
};

// POST /auth/signUp
exports.signUp = async (req, res) => {
    const { firstname, lastname, email, username, password } = req.body;

    if (isMockMode()) {
        const normalizedUsername = normalizeUsername(username);

        if (!normalizedUsername || !password || !email) {
            return res.status(400).json({ message: 'username, email, and password are required' });
        }

        const users = readMockUsers();

        if (users[normalizedUsername]) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const passwordData = hashPassword(password);

        users[normalizedUsername] = {
            username: normalizedUsername,
            firstname,
            lastname,
            email,
            passwordHash: passwordData.hash,
            passwordSalt: passwordData.salt,
            confirmed: false,
            createdAt: new Date().toISOString()
        };

        writeMockUsers(users);

        return res.status(200).json({
            message: 'Sign up successful. Use any confirmation code to confirm this mock account. (Mock Mode Enabled)'
        });
    }

    try {
        const { clientId } = getCognitoConfig();
        const command = new SignUpCommand({
            ClientId: clientId,
            Username: username,
            Password: password,
            UserAttributes: [
                { Name: 'email', Value: email },
                { Name: 'given_name', Value: firstname },
                { Name: 'family_name', Value: lastname }
            ]
        });

        await getCognitoClient().send(command);
        res.status(200).json({ message: 'Sign up successful. Check your email for the confirmation code.' });

    } catch (error) {
        if (handleCognitoConfigError(error, res)) return;
        console.error('SignUp error FULL:', JSON.stringify(error, null, 2));
        console.error('SignUp error name:', error.name);
        console.error('SignUp error message:', error.message);
        console.error('SignUp error code:', error.Code || error.__type);
        res.status(400).json({ message: error.message || error.name || JSON.stringify(error) });
    }
};


// POST /auth/signUpConfirm
exports.signUpConfirm = async (req, res) => {
    const { username, confirmationcode } = req.body;

    if (isMockMode()) {
        const normalizedUsername = normalizeUsername(username);
        const users = readMockUsers();
        const user = users[normalizedUsername];

        if (!user) {
            return res.status(404).json({ message: 'User does not exist. Please create an account first.' });
        }

        if (!confirmationcode) {
            return res.status(400).json({ message: 'Confirmation code is required' });
        }

        user.confirmed = true;
        user.confirmedAt = new Date().toISOString();
        users[normalizedUsername] = user;
        writeMockUsers(users);

        return res.status(200).json({ message: 'Account confirmed successfully. (Mock Mode Enabled)' });
    }

    try {
        const { clientId } = getCognitoConfig();
        const command = new ConfirmSignUpCommand({
            ClientId: clientId,
            Username: username,
            ConfirmationCode: confirmationcode
        });

        await getCognitoClient().send(command);
        res.status(200).json({ message: 'Account confirmed successfully.' });

    } catch (error) {
        if (handleCognitoConfigError(error, res)) return;
        console.error('ConfirmSignUp error:', error);
        res.status(400).json({ message: error.message || 'Confirmation failed' });
    }
};


// POST /auth/authenticate
exports.authenticate = async (req, res) => {
    const { userName, userPassword } = req.body;

    if (isMockMode()) {
        const normalizedUsername = normalizeUsername(userName);
        const users = readMockUsers();
        const user = users[normalizedUsername];

        if (!user) {
            return res.status(401).json({ message: 'User does not exist. Please create an account first.' });
        }

        if (!user.confirmed) {
            return res.status(401).json({ message: 'User is not confirmed' });
        }

        if (!verifyPassword(userPassword, user)) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        const mockToken = generateMockToken(normalizedUsername);
        return res.status(200).json({
            userName: normalizedUsername,
            cognitoSession: mockToken,
            idToken: mockToken,
            refreshToken: 'mock-refresh-token',
            expiresIn: 36000
        });
    }

    try {
        const { clientId } = getCognitoConfig();
        const command = new InitiateAuthCommand({
            AuthFlow: 'USER_PASSWORD_AUTH',
            ClientId: clientId,
            AuthParameters: {
                USERNAME: userName,
                PASSWORD: userPassword
            }
        });

        const response = await getCognitoClient().send(command);

        // First time login — Cognito forces password change
        if (response.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
            return res.status(202).json({
                message: 'New password required',
                session: response.Session
            });
        }

        const tokens = response.AuthenticationResult;

        res.status(200).json({
            userName: userName,
            cognitoSession: tokens.AccessToken,
            idToken: tokens.IdToken,
            refreshToken: tokens.RefreshToken,
            expiresIn: tokens.ExpiresIn
        });

    } catch (error) {
        if (handleCognitoConfigError(error, res)) return;
        console.error('Authenticate error:', error);
        res.status(401).json({ message: error.message || 'Authentication failed' });
    }
};


// POST /auth/forgotPassword/:username
exports.forgotPassword = async (req, res) => {
    const { username } = req.params;

    if (isMockMode()) {
        const normalizedUsername = normalizeUsername(username);
        const users = readMockUsers();

        if (!users[normalizedUsername]) {
            return res.status(404).json({ message: 'User does not exist. Please create an account first.' });
        }

        return res.status(200).json({ message: 'Password reset code sent to your email. Use any code in mock mode.' });
    }

    try {
        const { clientId } = getCognitoConfig();
        const command = new ForgotPasswordCommand({
            ClientId: clientId,
            Username: username
        });

        await getCognitoClient().send(command);
        res.status(200).json({ message: 'Password reset code sent to your email.' });

    } catch (error) {
        if (handleCognitoConfigError(error, res)) return;
        console.error('ForgotPassword error:', error);
        res.status(400).json({ message: error.message || 'Failed to initiate password reset' });
    }
};


// POST /auth/confirmPassword/:username/:code/:newpassword
exports.confirmPassword = async (req, res) => {
    const { username, code, newpassword } = req.params;

    if (isMockMode()) {
        const normalizedUsername = normalizeUsername(username);
        const users = readMockUsers();
        const user = users[normalizedUsername];

        if (!user) {
            return res.status(404).json({ message: 'User does not exist. Please create an account first.' });
        }

        if (!code || !newpassword) {
            return res.status(400).json({ message: 'Reset code and new password are required' });
        }

        const passwordData = hashPassword(newpassword);
        user.passwordHash = passwordData.hash;
        user.passwordSalt = passwordData.salt;
        user.updatedAt = new Date().toISOString();
        users[normalizedUsername] = user;
        writeMockUsers(users);

        return res.status(200).json({ message: 'Password reset successful. (Mock Mode Enabled)' });
    }

    try {
        const { clientId } = getCognitoConfig();
        const command = new ConfirmForgotPasswordCommand({
            ClientId: clientId,
            Username: username,
            ConfirmationCode: code,
            Password: newpassword
        });

        await getCognitoClient().send(command);
        res.status(200).json({ message: 'Password reset successful.' });

    } catch (error) {
        if (handleCognitoConfigError(error, res)) return;
        console.error('ConfirmPassword error:', error);
        res.status(400).json({ message: error.message || 'Password reset failed' });
    }
};


// POST /auth/resendCode
exports.resendCode = async (req, res) => {
    const { username } = req.body;

    if (isMockMode()) {
        const normalizedUsername = normalizeUsername(username);
        const users = readMockUsers();

        if (!users[normalizedUsername]) {
            return res.status(404).json({ message: 'User does not exist. Please create an account first.' });
        }

        return res.status(200).json({ message: 'Confirmation code resent. (Mock Mode Enabled)' });
    }

    try {
        const { clientId } = getCognitoConfig();
        const command = new ResendConfirmationCodeCommand({
            ClientId: clientId,
            Username: username
        });

        await getCognitoClient().send(command);
        res.status(200).json({ message: 'Confirmation code resent.' });

    } catch (error) {
        if (handleCognitoConfigError(error, res)) return;
        console.error('ResendCode error:', error);
        res.status(400).json({ message: error.message || 'Failed to resend code' });
    }
};
