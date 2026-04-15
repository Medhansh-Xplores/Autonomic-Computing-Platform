
cluster_name = "task-app"
region       = "us-east-1"
vpc_id       = "vpc-0dedf3ce631d63307"

cpu          = 256
memory       = 512

zone_name    = "task-app"
created_by   = "ACP-Portal"

role_arn     = "arn:aws:iam::377122171982:role/ACPDeploymentRole"

# Default values (can override later)
container_port    = 4000
listener_priority = 100
path_patterns     = ["/api/*"]

environment_variables = []
