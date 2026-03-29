# -----------------------------
# ECR Repositories
# -----------------------------

resource "aws_ecr_repository" "frontend" {
  name = "${var.zone_name}-frontend"

  tags = merge(var.common_tags, {
    Name = "${var.zone_name}-frontend"
    Type = "ECR"
  })
}

resource "aws_ecr_repository" "backend" {
  name = "${var.zone_name}-backend"

  tags = merge(var.common_tags, {
    Name = "${var.zone_name}-backend"
    Type = "ECR"
  })
}

# -----------------------------
# ECS Cluster
# -----------------------------

resource "aws_ecs_cluster" "main" {
  name = var.cluster_name

  tags = merge(var.common_tags, {
    Name = var.cluster_name
    Type = "ECS-Cluster"
  })
}

# -----------------------------
# CloudWatch Logs
# -----------------------------

resource "aws_cloudwatch_log_group" "ecs" {
  name = "/ecs/${var.cluster_name}"

  tags = merge(var.common_tags, {
    Type = "CloudWatch"
  })
}

# -----------------------------
# IAM Role
# -----------------------------

resource "aws_iam_role" "ecs_task_execution_role" {
  name = "${var.cluster_name}-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
      Effect = "Allow"
    }]
  })

  tags = merge(var.common_tags, {
    Type = "IAM"
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# -----------------------------
# Security Group
# -----------------------------

resource "aws_security_group" "ecs" {
  name   = "${var.cluster_name}-sg"
  vpc_id = var.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.common_tags, {
    Type = "SecurityGroup"
  })
}

# -----------------------------
# ALB
# -----------------------------

resource "aws_lb" "ecs" {
  name               = "${var.cluster_name}-alb"
  load_balancer_type = "application"
  subnets            = var.subnets
  security_groups    = [aws_security_group.ecs.id]

  tags = merge(var.common_tags, {
    Type = "LoadBalancer"
  })
}

# -----------------------------
# Target Groups
# -----------------------------

resource "aws_lb_target_group" "frontend" {
  name     = "${var.cluster_name}-frontend"
  port     = 80
  protocol = "HTTP"
  vpc_id   = var.vpc_id
  target_type = "ip"

  tags = merge(var.common_tags, {
    Type = "TargetGroup"
  })
}

resource "aws_lb_target_group" "backend" {
  name     = "${var.cluster_name}-backend"
  port     = 5000
  protocol = "HTTP"
  vpc_id   = var.vpc_id
  target_type = "ip"

  tags = merge(var.common_tags, {
    Type = "TargetGroup"
  })
}

# -----------------------------
# Listener
# -----------------------------

resource "aws_lb_listener" "frontend" {
  load_balancer_arn = aws_lb.ecs.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

# -----------------------------
# Listener Rule Backend
# -----------------------------

resource "aws_lb_listener_rule" "backend" {
  listener_arn = aws_lb_listener.frontend.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
}

# -----------------------------
# ECS Task Definitions
# -----------------------------

resource "aws_ecs_task_definition" "frontend" {
  family                   = "${var.cluster_name}-frontend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cpu
  memory                   = var.memory

  execution_role_arn = aws_iam_role.ecs_task_execution_role.arn

  container_definitions = jsonencode([
    {
      name  = "frontend"
      image = aws_ecr_repository.frontend.repository_url

      portMappings = [
        {
          containerPort = 80
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group = aws_cloudwatch_log_group.ecs.name
          awslogs-region = var.region
          awslogs-stream-prefix = "frontend"
        }
      }
    }
  ])
}

resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.cluster_name}-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cpu
  memory                   = var.memory

  execution_role_arn = aws_iam_role.ecs_task_execution_role.arn

  container_definitions = jsonencode([
    {
      name  = "backend"
      image = aws_ecr_repository.backend.repository_url

      portMappings = [
        {
          containerPort = 5000
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group = aws_cloudwatch_log_group.ecs.name
          awslogs-region = var.region
          awslogs-stream-prefix = "backend"
        }
      }
    }
  ])
}

# -----------------------------
# ECS Services
# -----------------------------

resource "aws_ecs_service" "frontend" {
  name            = "frontend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = var.subnets
    security_groups = [aws_security_group.ecs.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.frontend.arn
    container_name   = "frontend"
    container_port   = 80
  }

  depends_on = [aws_lb_listener.frontend]

  tags = merge(var.common_tags, {
    Type = "ECS-Service"
  })
}

resource "aws_ecs_service" "backend" {
  name            = "backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = var.subnets
    security_groups = [aws_security_group.ecs.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 5000
  }

  depends_on = [aws_lb_listener.frontend]

  tags = merge(var.common_tags, {
    Type = "ECS-Service"
  })
}