
region     = "us-east-1"

app_name   = "my-app"
zone_name  = "dev-ecs"
vpc_id     = "vpc-0f71b2ce07cf550f9"

cluster_id         = "arn:aws:ecs:us-east-1:997053010568:cluster/dev-ecs"
execution_role_arn = "arn:aws:iam::997053010568:role/dev-ecs-execution-role"
log_group_name     = "/ecs/dev-ecs"
http_listener_arn  = "arn:aws:elasticloadbalancing:us-east-1:997053010568:listener/app/dev-ecs-alb/6b679d28c5bc563f/82914559bde1190d"
security_group_id  = "sg-040988df67a8fe1df"
private_subnet_ids = ["subnet-0b7d1d46b6aba51d7","subnet-0d2fce748b443234f"]

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
