# ============================================================
# APP INFRA  (deploy once per application)
# Requires the cluster stack to be applied first.
# Reference cluster outputs via data.terraform_remote_state
# or pass them in directly as variables (see variables.tf).
# ============================================================

# -----------------------------
# ECR Repositories
# -----------------------------

resource "aws_ecr_repository" "frontend" {
  name         = "${var.app_name}-frontend"
  force_delete = true

  tags = {
    CreatedBy = var.created_by
  }
}

resource "aws_ecr_repository" "backend" {
  name         = "${var.app_name}-backend"
  force_delete = true

  tags = {
    CreatedBy = var.created_by
  }
}

# -----------------------------
# Target Groups
# -----------------------------

resource "aws_lb_target_group" "frontend" {
  name        = "${var.app_name}-frontend"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 2
    matcher             = "200"
  }

  tags = {
    CreatedBy = var.created_by
  }
}

resource "aws_lb_target_group" "backend" {
  name        = "${var.app_name}-backend"
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  lifecycle {
    create_before_destroy = true
  }

  health_check {
    path                = "/health"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 2
    matcher             = "200"
  }

  tags = {
    CreatedBy = var.created_by
  }
}

# -----------------------------
# Listener Rules
# (attach to the shared ALB listener created in the cluster stack)
# -----------------------------

# Route frontend traffic — catch-all / root paths
resource "aws_lb_listener_rule" "frontend" {
  listener_arn = var.http_listener_arn
  priority     = var.frontend_listener_priority

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }

  condition {
    path_pattern {
      values = var.frontend_path_patterns
    }
  }
}

# Route backend traffic — API path patterns
resource "aws_lb_listener_rule" "backend" {
  listener_arn = var.http_listener_arn
  priority     = var.listener_priority

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    path_pattern {
      values = var.path_patterns
    }
  }
}

# -----------------------------
# ECS Task Definitions
# -----------------------------

resource "aws_ecs_task_definition" "frontend" {
  family                   = "${var.app_name}-frontend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = var.execution_role_arn

  container_definitions = jsonencode([
    {
      name  = "frontend"
      image = "${aws_ecr_repository.frontend.repository_url}:${var.frontend_image_tag}"

      portMappings = [
        {
          containerPort = 80
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = var.log_group_name
          awslogs-region        = var.region
          awslogs-stream-prefix = "frontend"
        }
      }
    }
  ])
}

resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.app_name}-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = var.execution_role_arn

  container_definitions = jsonencode([
    {
      name  = "backend"
      image = "${aws_ecr_repository.backend.repository_url}:${var.backend_image_tag}"

      portMappings = [
        {
          containerPort = var.container_port
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = var.log_group_name
          awslogs-region        = var.region
          awslogs-stream-prefix = "backend"
        }
      }

      environment = var.environment_variables
    }
  ])
}

# -----------------------------
# ECS Services
# -----------------------------

resource "aws_ecs_service" "frontend" {
  name            = "${var.app_name}-frontend"
  cluster         = var.cluster_id
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.frontend.arn
    container_name   = "frontend"
    container_port   = 80
  }

  depends_on = [
    aws_lb_listener_rule.frontend,
    aws_lb_target_group.frontend,
    aws_ecs_task_definition.frontend,
  ]

  tags = {
    CreatedBy = var.created_by
  }
}

resource "aws_ecs_service" "backend" {
  name            = "${var.app_name}-backend"
  cluster         = var.cluster_id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = var.container_port
  }

  depends_on = [
    aws_lb_listener_rule.backend,
    aws_lb_target_group.backend,
    aws_ecs_task_definition.backend,
  ]

  tags = {
    CreatedBy = var.created_by
  }
}
