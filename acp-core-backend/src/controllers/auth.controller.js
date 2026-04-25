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

const client = new CognitoIdentityProviderClient({
    region: process.env.COGNITO_REGION,
    requestHandler: new NodeHttpHandler({
        httpsAgent: new https.Agent({ family: 4 })  // force IPv4
    })
});

const CLIENT_ID = process.env.COGNITO_CLIENT_ID;

// POST /auth/signUp
exports.signUp = async (req, res) => {
    const { firstname, lastname, email, username, password } = req.body;

    try {
        const command = new SignUpCommand({
            ClientId: CLIENT_ID,
            Username: username,
            Password: password,
            UserAttributes: [
                { Name: 'email', Value: email },
                { Name: 'given_name', Value: firstname },
                { Name: 'family_name', Value: lastname }
            ]
        });

        await client.send(command);
        res.status(200).json({ message: 'Sign up successful. Check your email for the confirmation code.' });

    } catch (error) {
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

    try {
        const command = new ConfirmSignUpCommand({
            ClientId: CLIENT_ID,
            Username: username,
            ConfirmationCode: confirmationcode
        });

        await client.send(command);
        res.status(200).json({ message: 'Account confirmed successfully.' });

    } catch (error) {
        console.error('ConfirmSignUp error:', error);
        res.status(400).json({ message: error.message || 'Confirmation failed' });
    }
};


// POST /auth/authenticate
exports.authenticate = async (req, res) => {
    const { userName, userPassword } = req.body;

    try {
        const command = new InitiateAuthCommand({
            AuthFlow: 'USER_PASSWORD_AUTH',
            ClientId: CLIENT_ID,
            AuthParameters: {
                USERNAME: userName,
                PASSWORD: userPassword
            }
        });

        const response = await client.send(command);

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
        console.error('Authenticate error:', error);
        res.status(401).json({ message: error.message || 'Authentication failed' });
    }
};


// POST /auth/forgotPassword/:username
exports.forgotPassword = async (req, res) => {
    const { username } = req.params;

    try {
        const command = new ForgotPasswordCommand({
            ClientId: CLIENT_ID,
            Username: username
        });

        await client.send(command);
        res.status(200).json({ message: 'Password reset code sent to your email.' });

    } catch (error) {
        console.error('ForgotPassword error:', error);
        res.status(400).json({ message: error.message || 'Failed to initiate password reset' });
    }
};


// POST /auth/confirmPassword/:username/:code/:newpassword
exports.confirmPassword = async (req, res) => {
    const { username, code, newpassword } = req.params;

    try {
        const command = new ConfirmForgotPasswordCommand({
            ClientId: CLIENT_ID,
            Username: username,
            ConfirmationCode: code,
            Password: newpassword
        });

        await client.send(command);
        res.status(200).json({ message: 'Password reset successful.' });

    } catch (error) {
        console.error('ConfirmPassword error:', error);
        res.status(400).json({ message: error.message || 'Password reset failed' });
    }
};


// POST /auth/resendCode
exports.resendCode = async (req, res) => {
    const { username } = req.body;

    try {
        const command = new ResendConfirmationCodeCommand({
            ClientId: CLIENT_ID,
            Username: username
        });

        await client.send(command);
        res.status(200).json({ message: 'Confirmation code resent.' });

    } catch (error) {
        console.error('ResendCode error:', error);
        res.status(400).json({ message: error.message || 'Failed to resend code' });
    }
};