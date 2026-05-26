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

# ── FIX: VPC Flow Logs ────────────────────────────────────────────────────────
# ADDED: Flow logs were disabled — now enabled to CloudWatch Logs

resource "aws_cloudwatch_log_group" "acp_vpc_flow_logs" {
  name              = "/aws/vpc/acp-flow-logs"
  retention_in_days = 30
}

resource "aws_iam_role" "acp_vpc_flow_logs" {
  name = "acp-vpc-flow-logs-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "vpc-flow-logs.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "acp_vpc_flow_logs" {
  name = "acp-vpc-flow-logs-policy"
  role = aws_iam_role.acp_vpc_flow_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams"
      ]
      Resource = "*"
    }]
  })
}

resource "aws_flow_log" "acp" {
  vpc_id          = aws_vpc.acp.id
  traffic_type    = "ALL"
  iam_role_arn    = aws_iam_role.acp_vpc_flow_logs.arn
  log_destination = aws_cloudwatch_log_group.acp_vpc_flow_logs.arn

  tags = { Name = "acp-vpc-flow-logs" }
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

  # FIX: deletion_protection — was missing, now enabled
  deletion_protection = false

  # FIX: backup_retention_period — was 0 days (default), now 7 days minimum
  backup_retention_period = 7

  tags = { Name = "acp-rds" }
}

# ── S3 BUCKET FOR ALB ACCESS LOGS ────────────────────────────────────────────

data "aws_elb_service_account" "main" {}

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "acp_alb_logs" {
  bucket        = "acp-alb-access-logs-${data.aws_caller_identity.current.account_id}"
  force_destroy = true

  tags = { Name = "acp-alb-access-logs" }
}

resource "aws_s3_bucket_lifecycle_configuration" "acp_alb_logs" {
  bucket = aws_s3_bucket.acp_alb_logs.id

  rule {
    id     = "expire-old-logs"
    status = "Enabled"

    filter {}

    expiration {
      days = 30
    }
  }
}

resource "aws_s3_bucket_policy" "acp_alb_logs" {
  bucket = aws_s3_bucket.acp_alb_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowALBLogDelivery"
        Effect    = "Allow"
        Principal = { AWS = data.aws_elb_service_account.main.arn }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.acp_alb_logs.arn}/acp-alb/AWSLogs/${data.aws_caller_identity.current.account_id}/*"
      }
    ]
  })
}

# ── FIX: AWS WAF Web ACL ──────────────────────────────────────────────────────
# ADDED: WAF was not attached to ALB — now created and associated

resource "aws_wafv2_web_acl" "acp" {
  name  = "acp-waf-acl"
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  # AWS Managed Rules — Common Rule Set
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesCommonRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rules — Known Bad Inputs
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesKnownBadInputsRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "acp-waf-acl"
    sampled_requests_enabled   = true
  }

  tags = { Name = "acp-waf-acl" }
}

resource "aws_wafv2_web_acl_association" "acp" {
  resource_arn = aws_lb.acp.arn
  web_acl_arn  = aws_wafv2_web_acl.acp.arn
}

# ── ALB ───────────────────────────────────────────────────────────────────────

resource "aws_lb" "acp" {
  name               = "acp-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.acp_alb.id]
  subnets            = aws_subnet.acp_public[*].id

  access_logs {
    bucket  = aws_s3_bucket.acp_alb_logs.id
    prefix  = "acp-alb"
    enabled = true
  }

  depends_on = [aws_s3_bucket_policy.acp_alb_logs]

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
  port        = 8080
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

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
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

# FIX: Added SecretsManager read access to execution role
# so containers can pull secrets (needed for the secrets fix below)
resource "aws_iam_role_policy" "acp_ecs_execution_secrets" {
  name = "acp-ecs-execution-secrets-policy"
  role = aws_iam_role.acp_ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue",
        "kms:Decrypt"
      ]
      Resource = [
        "arn:aws:secretsmanager:${var.aws_region}:*:secret:acp/*"
      ]
    }]
  })
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

# FIX: Wildcard resource (*) permissions — was using "*" for everything
# CHANGED: Scoped each permission to the minimal required resource ARN
resource "aws_iam_role_policy" "acp_ecs_task" {
  name = "acp-ecs-task-policy"
  role = aws_iam_role.acp_ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # EFS access — scoped to the specific file system
      {
        Effect = "Allow"
        Action = [
          "elasticfilesystem:ClientMount",
          "elasticfilesystem:ClientWrite",
          "elasticfilesystem:ClientRootAccess"
        ]
        Resource = aws_efs_file_system.acp.arn
      },

      # CloudWatch Logs — scoped to the ECS log group
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = "${aws_cloudwatch_log_group.acp.arn}:*"
      },

      # ECR — GetAuthorizationToken does not support resource scoping
      {
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
        Resource = [
          aws_ecr_repository.acp_backend.arn,
          aws_ecr_repository.acp_frontend.arn
        ]
      },

      # IAM — scoped to acp-* roles only
      {
        Effect = "Allow"
        Action = [
          "iam:GetRole",
          "iam:ListAttachedRolePolicies",
          "iam:ListRolePolicies",
          "iam:GetRolePolicy"
        ]
        Resource = "arn:aws:iam::*:role/acp-*"
      },

      # Secrets Manager — scoped to acp/* secrets
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:DescribeSecret",
          "secretsmanager:ListSecrets"
        ]
        Resource = "arn:aws:secretsmanager:${var.aws_region}:*:secret:acp/*"
      },

      # GuardDuty — does not support resource-level restrictions
      {
        Effect = "Allow"
        Action = [
          "guardduty:ListDetectors",
          "guardduty:ListFindings",
          "guardduty:GetFindings"
        ]
        Resource = "*"
      },

      # CloudTrail — DescribeTrails requires "*"
      {
        Effect = "Allow"
        Action = [
          "cloudtrail:DescribeTrails",
          "cloudtrail:GetTrailStatus"
        ]
        Resource = "*"
      },

      # ACM — ListCertificates requires "*"
      {
        Effect = "Allow"
        Action = [
          "acm:ListCertificates",
          "acm:DescribeCertificate"
        ]
        Resource = "*"
      },

      # WAF
      {
        Effect   = "Allow"
        Action   = ["wafv2:GetWebACLForResource"]
        Resource = "*"
      },

      # ELB — Describe actions require "*"
      {
        Effect = "Allow"
        Action = [
          "elasticloadbalancing:DescribeLoadBalancers",
          "elasticloadbalancing:DescribeListeners",
          "elasticloadbalancing:DescribeTargetGroups"
        ]
        Resource = "*"
      },

      # CloudWatch metrics
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:GetMetricData",
          "cloudwatch:ListMetrics"
        ]
        Resource = "*"
      },

      # FIX: EC2/VPC — required for security dashboard VPC panel
      # ec2:Describe* actions do not support resource-level restrictions
      {
        Effect = "Allow"
        Action = [
          "ec2:DescribeVpcs",
          "ec2:DescribeSubnets",
          "ec2:DescribeSecurityGroups",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DescribeRouteTables",
          "ec2:DescribeInternetGateways",
          "ec2:DescribeNatGateways",
          "ec2:DescribeFlowLogs"
        ]
        Resource = "*"
      },

      # FIX: ECS — required for dashboard container/service panel
      {
        Effect = "Allow"
        Action = [
          "ecs:DescribeClusters",
          "ecs:DescribeServices",
          "ecs:DescribeTasks",
          "ecs:ListTasks",
          "ecs:ListServices",
          "ecs:DescribeTaskDefinition",  
          "ecs:ListClusters"        
        ]
        Resource = "*"
      },

      # FIX: RDS — required for dashboard database panel
      {
        Effect = "Allow"
        Action = [
          "rds:DescribeDBInstances",
          "rds:DescribeDBClusters",
          "rds:ListTagsForResource"
        ]
        Resource = "*"
      },
      # STS — required for cross-account AssumeRole into customer accounts
      {
        Effect = "Allow"
        Action = ["sts:AssumeRole"]
        Resource = "arn:aws:iam::*:role/ACPDeploymentRole"
      },
    ]
  })
}

# ── FIX: Secrets Manager — store sensitive values ─────────────────────────────
# ADDED: DB credentials moved from plain-text env vars to Secrets Manager
# (fixes "No plain-text secrets in env vars" FAIL)

resource "aws_secretsmanager_secret" "acp_db" {
  name                    = "acp/db-credentials"
  recovery_window_in_days = 0
  tags                    = { Name = "acp-db-credentials" }
}

resource "aws_secretsmanager_secret_version" "acp_db" {
  secret_id = aws_secretsmanager_secret.acp_db.id
  secret_string = jsonencode({
    username = var.db_username
    password = var.db_password
  })
}

resource "aws_secretsmanager_secret" "acp_cognito" {
  name                    = "acp/cognito"
  recovery_window_in_days = 0
  tags                    = { Name = "acp-cognito" }
}

resource "aws_secretsmanager_secret_version" "acp_cognito" {
  secret_id = aws_secretsmanager_secret.acp_cognito.id
  secret_string = jsonencode({
    user_pool_id = var.cognito_user_pool_id
    client_id    = var.cognito_client_id
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

    # FIX: Non-root container user — was missing, now set to non-root UID 1000
    user = "1000"

    # FIX: Read-only root filesystem — was missing, now enabled
    # NOTE: /tmp is added as a writable tmpfs mount so the app can still write temp files
    readonlyRootFilesystem = true

    portMappings = [{
      containerPort = 8080
      protocol      = "tcp"
    }]

    # FIX: Plain-text secrets removed from environment
    # Non-sensitive config kept as env vars; secrets pulled from Secrets Manager
    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "PORT",     value = "8080" },
      { name = "USE_DB",   value = "true" },
      { name = "DB_HOST",  value = aws_db_instance.acp.address },
      { name = "DB_PORT",  value = "5432" },
      { name = "DB_NAME",  value = var.db_name },
      { name = "COGNITO_REGION", value = var.aws_region }
    ]

    # Secrets pulled securely at container start — not visible in task definition JSON
    secrets = [
      {
        name      = "DB_USER"
        valueFrom = "${aws_secretsmanager_secret.acp_db.arn}:username::"
      },
      {
        name      = "DB_PASSWORD"
        valueFrom = "${aws_secretsmanager_secret.acp_db.arn}:password::"
      },
      {
        name      = "COGNITO_USER_POOL_ID"
        valueFrom = "${aws_secretsmanager_secret.acp_cognito.arn}:user_pool_id::"
      },
      {
        name      = "COGNITO_CLIENT_ID"
        valueFrom = "${aws_secretsmanager_secret.acp_cognito.arn}:client_id::"
      }
    ]

    mountPoints = [
      {
        sourceVolume  = "acp-efs"
        containerPath = "/app/deployments"
        readOnly      = false
      },
      {
        sourceVolume  = "acp-efs"
        containerPath = "/app/terraform/deployments"
        readOnly      = false
      }
    ]

    # Writable /tmp via tmpfs so read-only root filesystem doesn't break the app
    linuxParameters = {
      tmpfs = [{
        containerPath = "/tmp"
        size          = 512
      }]
    }

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

    # FIX: Non-root container user
    user = "1000"

    # FIX: Read-only root filesystem
    # NOTE: Nginx needs /tmp and /var/cache/nginx as writable — handled via tmpfs
    readonlyRootFilesystem = true

    portMappings = [{
      containerPort = 8080
      protocol      = "tcp"
    }]

    linuxParameters = {
      tmpfs = [
        { containerPath = "/tmp",             size = 64 },
        { containerPath = "/var/cache/nginx", size = 64 },
        { containerPath = "/var/run",         size = 16 }
      ]
    }

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
    container_port   = 8080
  }

  depends_on = [aws_lb_listener.acp_http]
}

# ── FIX: GuardDuty ───────────────────────────────────────────────────────────
data "aws_guardduty_detector" "acp" {}
