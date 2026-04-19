
region     = "us-east-1"
role_arn   = "arn:aws:iam::377122171982:role/ACPDeploymentRole"

app_name   = "task-management-app"
zone_name  = "dev-ecs"
vpc_id     = "vpc-06b22515da0c9f0d7"

cluster_id         = "arn:aws:ecs:us-east-1:377122171982:cluster/dev-ecs"
execution_role_arn = "arn:aws:iam::377122171982:role/dev-ecs-execution-role"
log_group_name     = "/ecs/dev-ecs"
http_listener_arn  = "arn:aws:elasticloadbalancing:us-east-1:377122171982:listener/app/dev-ecs-alb/a2ab31b550fde338/0cea7faf0d27bde8"
security_group_id  = "sg-0f44fdc0f28f2b963"
private_subnet_ids = ["subnet-02c4ee43c937226f0","subnet-096af95bcf0c202d1"]

cpu            = 256
memory         = 512
container_port = 4000

listener_priority          = 100
path_patterns              = ["/tasks/api/*"]
frontend_listener_priority = 101
frontend_path_patterns     = ["/*"]

environment_variables = []
