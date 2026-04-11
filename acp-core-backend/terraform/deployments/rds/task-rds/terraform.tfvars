
region          = "us-east-1"
rds_identifier  = "task-rds"
db_engine       = "postgres"

db_username     = "ansh"
db_password     = "8466093937"

vpc_id          = "vpc-0c61484a02f473de5"
subnet_ids      = ["subnet-0f5ea9e57b84f2845","subnet-0e810fbd02ecdeebe"]

create_db       = true
initial_db_name = "task_db"

zone_name       = "task-rds"
role_arn        = "arn:aws:iam::377122171982:role/ACPDeploymentRole"
