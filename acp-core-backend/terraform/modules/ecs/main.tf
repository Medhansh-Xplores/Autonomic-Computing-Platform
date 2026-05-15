# ============================================================
# COMMON / CLUSTER INFRA
# Provisions once per environment. All app stacks reference
# outputs from this layer via remote_state or passed variables.
# ============================================================

# -----------------------------
# Subnet data sources
# -----------------------------

data "aws_subnets" "public" {
  filter {
    name   = "vpc-id"
    values = [var.vpc_id]
  }

  filter {
    name   = "tag:Name"
    values = ["*-public-subnet-*"]
  }
}

data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [var.vpc_id]
  }

  filter {
    name   = "tag:Name"
    values = ["*-private-subnet-*"]
  }
}

# -----------------------------
# Caller Identity (for account ID)
# -----------------------------

data "aws_caller_identity" "current" {}

# -----------------------------
# NAT Gateway
# -----------------------------

resource "aws_eip" "nat" {
  domain = "vpc"

  tags = {
    CreatedBy = var.created_by
  }
}

resource "aws_nat_gateway" "ecs" {
  allocation_id = aws_eip.nat.id
  subnet_id     = data.aws_subnets.public.ids[0]

  tags = {
    CreatedBy = var.created_by
  }

  depends_on = [aws_eip.nat]
}

resource "aws_route_table" "private" {
  vpc_id = var.vpc_id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.ecs.id
  }

  tags = {
    CreatedBy = var.created_by
  }
}

resource "aws_route_table_association" "private" {
  count          = length(data.aws_subnets.private.ids)
  subnet_id      = data.aws_subnets.private.ids[count.index]
  route_table_id = aws_route_table.private.id
}

# -----------------------------
# ECS Cluster
# -----------------------------

resource "aws_ecs_cluster" "main" {
  name = var.cluster_name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    CreatedBy = var.created_by
  }
}

# -----------------------------
# CloudWatch Log Group
# -----------------------------

resource "aws_cloudwatch_log_group" "ecs" {
  name = "/ecs/${var.cluster_name}"

  tags = {
    CreatedBy = var.created_by
  }
}

# -----------------------------
# IAM Task Execution Role
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

  tags = {
    CreatedBy = var.created_by
  }
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# -----------------------------
# Shared Security Group
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

  ingress {
    from_port = 0
    to_port   = 0
    protocol  = "-1"
    self      = true
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    CreatedBy = var.created_by
  }
}

# -----------------------------
# S3 Bucket for ALB Access Logs
# -----------------------------

resource "aws_s3_bucket" "alb_logs" {
  bucket        = "${var.cluster_name}-alb-access-logs"
  force_destroy = true

  tags = {
    CreatedBy = var.created_by
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  rule {
    id     = "expire-logs"
    status = "Enabled"

    expiration {
      days = 90
    }
  }
}

resource "aws_s3_bucket_policy" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${var.elb_account_id}:root"
        }
        Action   = "s3:PutObject"
        Resource = "arn:aws:s3:::${aws_s3_bucket.alb_logs.bucket}/${var.cluster_name}/AWSLogs/${data.aws_caller_identity.current.account_id}/*"
      }
    ]
  })
}

# -----------------------------
# ALB (shared across apps)
# -----------------------------

resource "aws_lb" "ecs" {
  name               = "${var.cluster_name}-alb"
  load_balancer_type = "application"
  subnets            = data.aws_subnets.public.ids
  security_groups    = [aws_security_group.ecs.id]
  internal           = false

  access_logs {
    bucket  = aws_s3_bucket.alb_logs.bucket
    prefix  = var.cluster_name
    enabled = true
  }

  tags = {
    CreatedBy = var.created_by
  }

  depends_on = [aws_s3_bucket_policy.alb_logs]
}

# Default HTTP listener
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.ecs.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "No route matched"
      status_code  = "404"
    }
  }
}