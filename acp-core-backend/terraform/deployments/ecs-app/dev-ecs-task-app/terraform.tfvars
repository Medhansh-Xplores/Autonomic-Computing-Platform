
region     = "us-east-1"

app_name   = "task-app"
zone_name  = "dev-ecs"
vpc_id     = "vpc-001c9ee3c0e4c3db2"

cluster_id         = "arn:aws:ecs:us-east-1:997053010568:cluster/dev-ecs"
execution_role_arn = "arn:aws:iam::997053010568:role/dev-ecs-execution-role"
log_group_name     = "/ecs/dev-ecs"
http_listener_arn  = "arn:aws:elasticloadbalancing:us-east-1:997053010568:listener/app/dev-ecs-alb/4aaba67c13d647a9/f88b3ce125cba1ef"
security_group_id  = "sg-07d0fc64454f5da4c"
private_subnet_ids = ["subnet-02a6c62ca0c151fe5","subnet-00a59a79d9754c18e"]

cpu            = 256
memory         = 512
container_port = 4000

listener_priority          = 100
path_patterns              = ["/tasks/api/*"]
frontend_listener_priority = 101
frontend_path_patterns     = ["/tasks","/tasks/*"]

environment_variables = [
  { name = "USE_DB",      value = "true" },
  { name = "DB_HOST",     value = "" },
  { name = "DB_PORT",     value = "5432" },
  { name = "DB_USER",     value = "" },
  { name = "DB_PASSWORD", value = "" },
  { name = "DB_NAME",     value = "" }
]
