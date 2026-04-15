
region          = "us-east-1"
rds_identifier  = "task-rds"
db_engine       = "postgres"

db_username     = "appuser"
db_password     = "password"

vpc_id          = "vpc-0dedf3ce631d63307"
subnet_ids      = ["subnet-030f8f6d35a2c05b0","subnet-0e11009d8c7218a61"]

create_db       = true
initial_db_name = "appdb"

zone_name       = "task-rds"
role_arn        = "arn:aws:iam::377122171982:role/ACPDeploymentRole"
