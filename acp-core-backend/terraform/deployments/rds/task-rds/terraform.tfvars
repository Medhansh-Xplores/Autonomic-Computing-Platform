
region          = "us-east-1"
rds_identifier  = "task-rds"
db_engine       = "postgres"

db_username     = "appuser"
db_password     = "password"

vpc_id          = "vpc-06b22515da0c9f0d7"
subnet_ids      = ["subnet-02c4ee43c937226f0","subnet-096af95bcf0c202d1"]

create_db       = true
initial_db_name = "appdb"

zone_name       = "task-rds"
role_arn        = "arn:aws:iam::377122171982:role/ACPDeploymentRole"
