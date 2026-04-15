const awsService = require('../services/aws.service');
const { connectEcsToRds } = require('../services/aws.service');


exports.getAwsAccounts = async (req, res) => {

    try {

        const accounts = await awsService.getAwsAccounts();
        res.json(accounts);

    } catch (error) {

        console.error('Error getting AWS accounts:', error);
        res.status(500).json({ error: 'Failed to fetch AWS accounts' });

    }

};


exports.getAwsRegions = async (req, res) => {

    try {

        const account = req.query.account;

        const regions = await awsService.getAwsRegions(account);

        res.json(regions);

    } catch (error) {

        console.error('Error getting AWS regions:', error);
        res.status(500).json({ error: 'Failed to fetch AWS regions' });

    }

};


exports.getAwsEcsClusters = async (req, res) => {

    try {

        const account = req.query.account;
        const region = req.query.region;

        const clusters = await awsService.getAwsEcsClusters(account, region);

        res.json(clusters);

    } catch (error) {

        console.error('Error getting ECS clusters:', error);
        res.status(500).json({ error: 'Failed to fetch ECS clusters' });

    }

};

exports.getAwsRdsInstances = async (req, res) => {

    try {

        const account = req.query.account;
        const region = req.query.region;

        const rds = await awsService.getAwsRdsInstances(account, region);

        res.json(rds);

    } catch (error) {

        console.error('Error getting RDS instances:', error);
        res.status(500).json({ error: 'Failed to fetch RDS instances' });

    }

};
