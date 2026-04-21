# ── VPC ───────────────────────────────────────────────────────────────────────

resource "aws_vpc" "acp" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "acp-vpc" }
}

resource "aws_internet_gateway" "acp" {
  vpc_id = aws_vpc.acp.id
  tags   = { Name = "acp-igw" }
}

resource "aws_subnet" "acp_public" {
  count                   = 2
  vpc_id                  = aws_vpc.acp.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = { Name = "acp-public-subnet-${count.index + 1}" }
}

resource "aws_subnet" "acp_private" {
  count             = 2
  vpc_id            = aws_vpc.acp.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = { Name = "acp-private-subnet-${count.index + 1}" }
}

resource "aws_eip" "acp_nat" {
  domain = "vpc"
  tags   = { Name = "acp-nat-eip" }
}

resource "aws_nat_gateway" "acp" {
  allocation_id = aws_eip.acp_nat.id
  subnet_id     = aws_subnet.acp_public[0].id
  tags          = { Name = "acp-nat" }
}

resource "aws_route_table" "acp_public" {
  vpc_id = aws_vpc.acp.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.acp.id
  }

  tags = { Name = "acp-public-rt" }
}

resource "aws_route_table" "acp_private" {
  vpc_id = aws_vpc.acp.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.acp.id
  }

  tags = { Name = "acp-private-rt" }
}

resource "aws_route_table_association" "acp_public" {
  count          = 2
  subnet_id      = aws_subnet.acp_public[count.index].id
  route_table_id = aws_route_table.acp_public.id
}

resource "aws_route_table_association" "acp_private" {
  count          = 2
  subnet_id      = aws_subnet.acp_private[count.index].id
  route_table_id = aws_route_table.acp_private.id
}

# ── SECURITY GROUPS ───────────────────────────────────────────────────────────

resource "aws_security_group" "acp_alb" {
  name   = "acp-alb-sg"
  vpc_id = aws_vpc.acp.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "acp-alb-sg" }
}

resource "aws_security_group" "acp_ecs" {
  name   = "acp-ecs-sg"
  vpc_id = aws_vpc.acp.id

  ingress {
    from_port       = 0
    to_port         = 0
    protocol        = "-1"
    security_groups = [aws_security_group.acp_alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "acp-ecs-sg" }
}

resource "aws_security_group" "acp_rds" {
  name   = "acp-rds-sg"
  vpc_id = aws_vpc.acp.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.acp_ecs.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "acp-rds-sg" }
}

resource "aws_security_group" "acp_efs" {
  name   = "acp-efs-sg"
  vpc_id = aws_vpc.acp.id

  ingress {
    from_port       = 2049
    to_port         = 2049
    protocol        = "tcp"
    security_groups = [aws_security_group.acp_ecs.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "acp-efs-sg" }
}

# ── ECR ───────────────────────────────────────────────────────────────────────

resource "aws_ecr_repository" "acp_backend" {
  name                 = "acp-backend"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = { Name = "acp-backend" }
}

resource "aws_ecr_repository" "acp_frontend" {
  name                 = "acp-frontend"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = { Name = "acp-frontend" }
}

# ── EFS ───────────────────────────────────────────────────────────────────────

resource "aws_efs_file_system" "acp" {
  encrypted = true
  tags      = { Name = "acp-efs" }
}

resource "aws_efs_mount_target" "acp" {
  count           = 2
  file_system_id  = aws_efs_file_system.acp.id
  subnet_id       = aws_subnet.acp_private[count.index].id
  security_groups = [aws_security_group.acp_efs.id]
}

# ── RDS ───────────────────────────────────────────────────────────────────────

resource "aws_db_subnet_group" "acp" {
  name       = "acp-db-subnet-group"
  subnet_ids = aws_subnet.acp_private[*].id
  tags       = { Name = "acp-db-subnet-group" }
}

resource "aws_db_instance" "acp" {
  identifier             = "acp-rds"
  engine                 = "postgres"
  engine_version         = "15"
  instance_class         = var.db_instance_class
  allocated_storage      = 20
  storage_encrypted      = true
  db_name                = var.db_name
  username               = var.db_username
  password               = var.db_password
  db_subnet_group_name   = aws_db_subnet_group.acp.name
  vpc_security_group_ids = [aws_security_group.acp_rds.id]
  skip_final_snapshot    = true
  publicly_accessible    = false

  tags = { Name = "acp-rds" }
}

# ── ALB ───────────────────────────────────────────────────────────────────────

resource "aws_lb" "acp" {
  name               = "acp-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.acp_alb.id]
  subnets            = aws_subnet.acp_public[*].id

  tags = { Name = "acp-alb" }
}

resource "aws_lb_target_group" "acp_backend" {
  name        = "acp-backend-tg"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = aws_vpc.acp.id
  target_type = "ip"

  health_check {
    path                = "/health"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = { Name = "acp-backend-tg" }
}

resource "aws_lb_target_group" "acp_frontend" {
  name        = "acp-frontend-tg"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = aws_vpc.acp.id
  target_type = "ip"

  health_check {
    path                = "/"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = { Name = "acp-frontend-tg" }
}

resource "aws_lb_listener" "acp_http" {
  load_balancer_arn = aws_lb.acp.arn
  port              = 80
  protocol          = "HTTP"

  # Default action — send to frontend
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.acp_frontend.arn
  }
}

resource "aws_lb_listener_rule" "acp_backend" {
  listener_arn = aws_lb_listener.acp_http.arn
  priority     = 10

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.acp_backend.arn
  }
}

# ── ECS CLUSTER ───────────────────────────────────────────────────────────────

resource "aws_ecs_cluster" "acp" {
  name = "acp-cluster"
  tags = { Name = "acp-cluster" }
}

resource "aws_cloudwatch_log_group" "acp" {
  name              = "/ecs/acp"
  retention_in_days = 7
}

# ── IAM ───────────────────────────────────────────────────────────────────────

resource "aws_iam_role" "acp_ecs_execution" {
  name = "acp-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "acp_ecs_execution" {
  role       = aws_iam_role.acp_ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "acp_ecs_task" {
  name = "acp-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "acp_ecs_task" {
  name = "acp-ecs-task-policy"
  role = aws_iam_role.acp_ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "elasticfilesystem:ClientMount",
          "elasticfilesystem:ClientWrite",
          "elasticfilesystem:ClientRootAccess"
        ]
        Resource = aws_efs_file_system.acp.arn
      },
      {
        Effect = "Allow"
        Action = [
          "sts:AssumeRole",
          "ec2:*",
          "ecs:*",
          "rds:*",
          "ecr:*",
          "logs:*"
        ]
        Resource = "*"
      }
    ]
  })
}

# ── ECS TASK DEFINITIONS ──────────────────────────────────────────────────────

resource "aws_ecs_task_definition" "acp_backend" {
  family                   = "acp-backend-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.backend_cpu
  memory                   = var.backend_memory
  execution_role_arn       = aws_iam_role.acp_ecs_execution.arn
  task_role_arn            = aws_iam_role.acp_ecs_task.arn

  volume {
    name = "acp-efs"

    efs_volume_configuration {
      file_system_id = aws_efs_file_system.acp.id
      root_directory = "/"
    }
  }

  container_definitions = jsonencode([{
    name      = "acp-backend"
    image     = var.backend_image
    essential = true

    portMappings = [{
      containerPort = 8080
      protocol      = "tcp"
    }]

    environment = [
      { name = "NODE_ENV",    value = "production" },
      { name = "PORT",        value = "8080" },
      { name = "USE_DB",      value = "true" },
      { name = "DB_HOST",     value = aws_db_instance.acp.address },
      { name = "DB_PORT",     value = "5432" },
      { name = "DB_NAME",     value = var.db_name },
      { name = "DB_USER",     value = var.db_username },
      { name = "DB_PASSWORD", value = var.db_password }
    ]

    mountPoints = [{
      sourceVolume  = "acp-efs"
      containerPath = "/app/deployments"
      readOnly      = false
    },
    {
      sourceVolume  = "acp-efs"
      containerPath = "/app/terraform"
      readOnly      = false
    }]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = "/ecs/acp"
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "backend"
      }
    }
  }])
}

resource "aws_ecs_task_definition" "acp_frontend" {
  family                   = "acp-frontend-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.frontend_cpu
  memory                   = var.frontend_memory
  execution_role_arn       = aws_iam_role.acp_ecs_execution.arn
  task_role_arn            = aws_iam_role.acp_ecs_task.arn

  container_definitions = jsonencode([{
    name      = "acp-frontend"
    image     = var.frontend_image
    essential = true

    portMappings = [{
      containerPort = 80
      protocol      = "tcp"
    }]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = "/ecs/acp"
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "frontend"
      }
    }
  }])
}

# ── ECS SERVICES ──────────────────────────────────────────────────────────────

resource "aws_ecs_service" "acp_backend" {
  name            = "acp-backend-service"
  cluster         = aws_ecs_cluster.acp.id
  task_definition = aws_ecs_task_definition.acp_backend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.acp_private[*].id
    security_groups = [aws_security_group.acp_ecs.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.acp_backend.arn
    container_name   = "acp-backend"
    container_port   = 8080
  }

  depends_on = [aws_lb_listener.acp_http]
}

resource "aws_ecs_service" "acp_frontend" {
  name            = "acp-frontend-service"
  cluster         = aws_ecs_cluster.acp.id
  task_definition = aws_ecs_task_definition.acp_frontend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.acp_private[*].id
    security_groups = [aws_security_group.acp_ecs.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.acp_frontend.arn
    container_name   = "acp-frontend"
    container_port   = 80
  }

  depends_on = [aws_lb_listener.acp_http]
}