
region     = "us-east-1"

app_name   = "task-app"
zone_name  = "dev-ecs"
vpc_id     = "vpc-0b9528b7c35d0a387"

cluster_id         = "arn:aws:ecs:us-east-1:997053010568:cluster/dev-ecs"
execution_role_arn = "arn:aws:iam::997053010568:role/dev-ecs-execution-role"
log_group_name     = "/ecs/dev-ecs"
http_listener_arn  = "arn:aws:elasticloadbalancing:us-east-1:997053010568:listener/app/dev-ecs-alb/81ea109ad8a198b5/1225eb2a98bef27c"
security_group_id  = "sg-0c9d2e123bf11096e"
private_subnet_ids = ["subnet-03209354681bc0355","subnet-05972fb834b2b7026"]

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
