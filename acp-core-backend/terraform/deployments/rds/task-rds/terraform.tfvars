
region          = "us-east-1"
rds_identifier  = "task-rds"
db_engine       = "mysql"
db_username     = "appuser"
db_password     = "password"
vpc_id          = "vpc-001c9ee3c0e4c3db2"
subnet_ids      = ["subnet-02a6c62ca0c151fe5", "subnet-00a59a79d9754c18e"]
create_db       = true
initial_db_name = "appdb"
zone_name       = "task-rds"
db_port         = 3306
