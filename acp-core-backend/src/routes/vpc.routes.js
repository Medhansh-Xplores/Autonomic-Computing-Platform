const express = require("express");
const router = express.Router();
const AWS = require("aws-sdk");

router.get("/vpcs", async (req, res) => {

    const region = req.query.region;

    const ec2 = new AWS.EC2({
        region: region
    });

    try {

        const data = await ec2.describeVpcs().promise();

        const vpcs = data.Vpcs.map(vpc => ({
            vpcId: vpc.VpcId,
            cidr: vpc.CidrBlock
        }));

        res.json(vpcs);

    } catch (err) {
        res.status(500).json(err);
    }

});

module.exports = router;