output "frontend_repo" {
  value = aws_ecr_repository.frontend.repository_url
}

output "backend_repo" {
  value = aws_ecr_repository.backend.repository_url
}

output "alb_dns" {
  value = aws_lb.ecs.dns_name
}

# -----------------------------
# Add These (Required for reuse)
# -----------------------------

output "ecs_cluster_id" {
  value = aws_ecs_cluster.main.id
}

output "execution_role_arn" {
  value = aws_iam_role.ecs_task_execution_role.arn
}

output "alb_listener_arn" {
  value = aws_lb_listener.frontend.arn
}

output "ecs_sg_id" {
  value = aws_security_group.ecs.id
}

output "vpc_id" {
  value = var.vpc_id
}

output "private_subnets" {
  value = data.aws_subnets.private.ids
}