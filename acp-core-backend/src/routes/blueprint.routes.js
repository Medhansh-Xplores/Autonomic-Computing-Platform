const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {

  const platform = req.query.platformTypeFilter;

  const blueprints = [
    {
      blueprintID: "aws-vpc",
      blueprintDescription: "AWS VPC",
      platformType: "AWS"
    },
    {
      blueprintID: "azure-vpc",
      blueprintDescription: "Azure VPC",
      platformType: "AZURE"
    },
    {
      blueprintID: "gcp-vpc",
      blueprintDescription: "GCP VPC",
      platformType: "GCP"
    },
    {
      blueprintID: "aws-ecs",
      blueprintDescription: "AWS ECS (Fargate)",
      platformType: "AWS"
    },
    {
      blueprintID: "aws-rds",
      blueprintDescription: "AWS RDS",
      platformType: "AWS"
    },
    {
      blueprintID: "aws-eks",
      blueprintDescription: "AWS EKS (Kubernetes)",
      platformType: "AWS"
    }
  ];

  const filtered = blueprints.filter(
    b => b.platformType === platform
  );

  res.json({
    items: filtered
  });

});

module.exports = router;